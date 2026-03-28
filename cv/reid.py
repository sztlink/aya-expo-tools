"""
AYA Expo Tools — ReID Pipeline
Associa tracks de múltiplas câmeras num reid_id único por visitante.

Arquitetura:
  - Lê detections.json + frame.jpg de cada câmera (output do detector.py)
  - Extrai features OSNet-x0_25 (Market-1501) dos crops de pessoa
  - Associa cross-câmera via cosine similarity
  - cam-1 <-> cam-3: threshold menor (mesma sala, ângulos opostos)
  - Mantém lifecycle de reid_ids (ativo → perdido → finalizado)
  - Escreve cv/output/reid/state.json a cada ciclo
  - Acumula visitantes únicos e dwell real no daily

Uso:
  python reid.py --config ../config/beleza-astral.json
"""

import argparse
import json
import os
import sys
import time
import uuid
import signal
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import defaultdict

import cv2
import numpy as np

SCRIPT_DIR  = Path(__file__).parent
OUTPUT_DIR  = SCRIPT_DIR / 'output' / 'reid'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

STATE_FILE  = OUTPUT_DIR / 'state.json'
STATUS_FILE = OUTPUT_DIR / 'status.json'

# ── Thresholds de similaridade ────────────────────────────────────────────────
THRESH_SAME_ZONE   = 0.65   # cam-1 <-> cam-3 (sala imersiva, ângulos opostos)
THRESH_CROSS_ZONE  = 0.72   # entre zonas diferentes
LOST_TIMEOUT_S     = 30     # segundos até marcar como perdido
FINALIZE_TIMEOUT_S = 900    # 15min sem aparecer → finalizar visita
MIN_DWELL_S        = 5      # descartar dwell abaixo disso (ruído)

# ── Filtro de staff ───────────────────────────────────────────────────────────
# Monitores da Beleza Astral usam uniforme verde-azulado (teal)
# HSV OpenCV: H=75-115 (teal/cyan), S=50-220, V=60-230
TEAL_H_MIN, TEAL_H_MAX = 75, 115
TEAL_S_MIN, TEAL_S_MAX = 50, 220
TEAL_V_MIN, TEAL_V_MAX = 60, 230
TEAL_MIN_AREA_PCT  = 0.10   # mínimo 10% do crop em teal para contar
TEAL_MIN_FRAMES    = 3      # confirmações para marcar como staff por cor
STAFF_TIME_MIN     = 180    # minutos — presença > 3h = staff por tempo

POLL_INTERVAL_S    = 2      # ciclo de polling

# Câmeras que cobrem a mesma zona (threshold menor)
SAME_ZONE_PAIRS = {('cam-1', 'cam-3'), ('cam-3', 'cam-1')}

# Zonas por câmera (simplificado — câmera pode ter múltiplas)
CAM_PRIMARY_ZONE = {
    'cam-1': 'sala-imersiva',
    'cam-2': 'galeria-principal',
    'cam-3': 'sala-imersiva',
    'cam-4': 'galeria',
}

running = True

def signal_handler(sig, frame):
    global running
    running = False

signal.signal(signal.SIGINT,  signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


# ── Persistência ──────────────────────────────────────────────────────────────

def write_json(path, data):
    tmp = str(path) + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(data, f)
    os.replace(tmp, str(path))


def write_status(status, **kw):
    write_json(STATUS_FILE, {
        'status': status,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'pid': os.getpid(),
        **kw,
    })


# ── Leitura do detector ───────────────────────────────────────────────────────

def read_camera(cam_id: str):
    """Le detections.json e frame.jpg de uma camera."""
    cam_dir = SCRIPT_DIR / 'output' / cam_id
    det_file   = cam_dir / 'detections.json'
    frame_file = cam_dir / 'frame.jpg'

    if not det_file.exists() or not frame_file.exists():
        return None, None

    try:
        det = json.loads(det_file.read_text())
    except Exception:
        return None, None

    if not det.get('detections'):
        return None, None

    try:
        frame = cv2.imread(str(frame_file))
        if frame is None:
            return None, None
    except Exception:
        return None, None

    return det, frame


# ── Extração de features ──────────────────────────────────────────────────────

def preprocess_crop(crop: np.ndarray) -> np.ndarray:
    """Redimensiona e normaliza crop para entrada do OSNet."""
    if crop is None or crop.size == 0:
        return None
    crop = cv2.resize(crop, (128, 256))  # W=128, H=256
    crop = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406])
    std  = np.array([0.229, 0.224, 0.225])
    crop = (crop - mean) / std
    return crop.transpose(2, 0, 1)[np.newaxis].astype(np.float32)  # [1, 3, 256, 128]


def extract_feature(sess, crop_np: np.ndarray):
    """Extrai feature vector L2-normalizado via OSNet ONNX."""
    inp = preprocess_crop(crop_np)
    if inp is None:
        return None
    try:
        feat = sess.run(['features'], {'image': inp})[0][0]
        norm = np.linalg.norm(feat)
        if norm < 1e-6:
            return None
        return feat / norm
    except Exception:
        return None


# ── Matching ──────────────────────────────────────────────────────────────────

def cosine_sim(a, b):
    return float(np.dot(a, b))


def threshold_for(cam_a, cam_b):
    if (cam_a, cam_b) in SAME_ZONE_PAIRS:
        return THRESH_SAME_ZONE
    return THRESH_CROSS_ZONE


# ── Estado principal ──────────────────────────────────────────────────────────


def is_teal_color(crop):
    """Retorna True se >= 10% do crop for teal (uniforme monitor)."""
    if crop is None or crop.size == 0: return False
    try:
        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, np.array([75, 50, 60]), np.array([115, 220, 230]))
        pct = mask.sum() / 255 / max(1, mask.size)
        return pct >= 0.10
    except: return False

class ReidState:
    def __init__(self):
        # reid_id → {tracks, firstSeen, lastSeen, zonesVisited, feature, finalized}
        self.visitors    = {}
        # (cam_id, track_id) → reid_id
        self.track_to_reid = {}
        # daily: date → {reid_ids: set, completed: list}
        self.daily       = defaultdict(lambda: {'reid_ids': set(), 'completed': []})
        self._today      = self._brt_date()

    def _brt_date(self):
        from datetime import timezone, timedelta
        brt = timezone(timedelta(hours=-3))
        return datetime.now(brt).strftime('%Y-%m-%d')

    def _new_reid_id(self):
        return 'r-' + uuid.uuid4().hex[:12]

    def update(self, cam_data: dict, sess):
        """
        cam_data: {cam_id: (detections_json, frame_np)}
        """
        now     = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        today   = self._brt_date()

        if today != self._today:
            self._today = today

        # 1. Extrair features para todos os tracks ativos
        current_tracks = {}  # (cam_id, track_id) → {feature, zone, cam}

        for cam_id, (det, frame) in cam_data.items():
            if det is None or frame is None:
                continue
            detections = det.get('detections', [])
            zones_map  = det.get('zones', {})

            for d in detections:
                tid = d.get('trackId')
                if tid is None:
                    continue

                x, y, w, h = d['x'], d['y'], d['w'], d['h']
                # Validar bbox
                fh, fw = frame.shape[:2]
                x1 = max(0, x); y1 = max(0, y)
                x2 = min(fw, x + w); y2 = min(fh, y + h)
                if x2 <= x1 or y2 <= y1 or (x2-x1)*(y2-y1) < 400:
                    continue

                crop = frame[y1:y2, x1:x2]
                feat = extract_feature(sess, crop)
                if feat is None:
                    continue

                # Zona primária desta câmera
                zone = CAM_PRIMARY_ZONE.get(cam_id, 'unknown')
                teal = is_teal_color(crop)

                current_tracks[(cam_id, tid)] = {
                    'feature': feat,
                    'zone':    zone,
                    'cam':     cam_id,
                    'isTeal':  teal,
                }

        # 2. Associar cada track a um reid_id
        assigned_this_cycle = {}  # (cam_id, track_id) → reid_id

        for key, info in current_tracks.items():
            cam_id, tid = key
            feat = info['feature']
            zone = info['zone']

            # Já tem reid_id deste ciclo?
            if key in self.track_to_reid:
                reid_id = self.track_to_reid[key]
                assigned_this_cycle[key] = reid_id
                continue

            # Tentar associar a reid_id existente por similaridade
            best_reid = None
            best_sim  = -1

            for reid_id, vis in self.visitors.items():
                if vis.get('finalized'):
                    continue
                ref_feat = vis.get('feature')
                if ref_feat is None:
                    continue
                # Só considerar se não está muito velho (max 5min)
                last_seen = vis.get('lastSeen')
                if last_seen:
                    try:
                        age = (now - datetime.fromisoformat(last_seen)).total_seconds()
                        if age > FINALIZE_TIMEOUT_S:
                            continue
                    except Exception:
                        pass

                # Threshold depende do par de câmeras
                ref_cams = vis.get('cameras', {})
                thresh   = THRESH_CROSS_ZONE
                for rc in ref_cams:
                    thresh = min(thresh, threshold_for(cam_id, rc))

                sim = cosine_sim(feat, ref_feat)
                if sim > thresh and sim > best_sim:
                    best_sim  = sim
                    best_reid = reid_id

            if best_reid is None:
                # Novo visitante
                best_reid = self._new_reid_id()
                self.visitors[best_reid] = {
                    'cameras':      {},
                    'firstSeen':    now_iso,
                    'lastSeen':     now_iso,
                    'zonesVisited': [zone],
                    'feature':      feat,
                    'finalized':    False,
                    'isStaff':      False,
                    'tealCount':    0,
                }

            assigned_this_cycle[key] = best_reid
            self.track_to_reid[key]  = best_reid

        # 3. Atualizar visitantes com tracks ativos
        # Agrupar tracks por reid_id para deduplicação cam-1/cam-3
        reid_to_tracks = defaultdict(list)
        for key, reid_id in assigned_this_cycle.items():
            reid_to_tracks[reid_id].append(key)

        for reid_id, keys in reid_to_tracks.items():
            vis  = self.visitors[reid_id]
            feat_sum = np.zeros(512, dtype=np.float32)
            n = 0
            for key in keys:
                cam_id, tid = key
                info = current_tracks[key]
                vis['cameras'][cam_id] = tid
                zone = info['zone']
                if zone not in vis['zonesVisited']:
                    vis['zonesVisited'].append(zone)
                feat_sum += info['feature']
                n += 1
                # Acumular detecções teal
                if info.get('isTeal'):
                    vis['tealCount'] = vis.get('tealCount', 0) + 1
                    if vis['tealCount'] >= TEAL_MIN_FRAMES:
                        vis['isStaff'] = True
            vis['lastSeen'] = now_iso
            # Verificar cor teal no crop (uniforme de monitor)
            for key in keys:
                cam_id2, tid2 = key
                info2 = current_tracks[key]
                # Recriar crop para verificação de cor (já foi processado)
                # Usar flag tealCount acumulado
                pass  # cor verificada abaixo em extract_feature com crop original
            # Threshold de tempo: > STAFF_TIME_MIN min = staff
            try:
                elapsed = (now - datetime.fromisoformat(vis['firstSeen'])).total_seconds() / 60
                if elapsed > STAFF_TIME_MIN and not vis.get('isStaff'):
                    vis['isStaff'] = True
            except Exception:
                pass
            # Feature fixa: manter a primeira observacao como referencia
            # (media ponderada causa drift ao longo do dia)
            if isinstance(vis['feature'], np.ndarray):
                vis['feature'] = vis['feature'].tolist()
            self.daily[today]['reid_ids'].add(reid_id)

        # 4. Limpar tracks que desapareceram desta câmera
        stale_keys = [k for k in self.track_to_reid if k not in current_tracks]
        for key in stale_keys:
            del self.track_to_reid[key]

        # 5. Finalizar visitantes ausentes há muito tempo
        for reid_id, vis in list(self.visitors.items()):
            if vis.get('finalized'):
                continue
            last_seen = vis.get('lastSeen', now_iso)
            try:
                age = (now - datetime.fromisoformat(last_seen)).total_seconds()
            except Exception:
                age = 0

            # Staff nunca finaliza — keepalive o dia inteiro
            if vis.get('isStaff') and age <= 3600:
                vis['lastSeen'] = now.isoformat()  # manter vivo
                continue
            if age > FINALIZE_TIMEOUT_S:
                first = vis.get('firstSeen', last_seen)
                try:
                    dwell = (datetime.fromisoformat(last_seen) - datetime.fromisoformat(first)).total_seconds()
                except Exception:
                    dwell = 0
                if dwell >= MIN_DWELL_S:
                    self.daily[today]['completed'].append({
                        'reidId':        reid_id,
                        'firstSeen':     first,
                        'lastSeen':      last_seen,
                        'dwellSeconds':  round(dwell),
                        'zonesVisited':  vis.get('zonesVisited', []),
                    })
                vis['finalized'] = True
                vis.pop('feature', None)
                for cam_k in list(vis.get('cameras', {}).keys()):
                    self.track_to_reid.pop((cam_k, vis['cameras'][cam_k]), None)

        # 6. Serializar feature como lista para JSON
        for vis in self.visitors.values():
            if isinstance(vis.get('feature'), np.ndarray):
                vis['feature'] = vis['feature'].tolist()

    def get_state(self):
        today = self._brt_date()
        d = self.daily[today]
        completed = d['completed']
        dwell_list = [v['dwellSeconds'] for v in completed if v['dwellSeconds'] >= MIN_DWELL_S]

        active = {
            k: {kk: vv for kk, vv in v.items() if kk != 'feature'}
            for k, v in self.visitors.items()
            if not v.get('finalized')
        }

        # Separar staff de visitantes reais
        all_ids     = d['reid_ids']
        staff_ids   = {rid for rid in all_ids if self.visitors.get(rid, {}).get('isStaff')}
        visitor_ids = all_ids - staff_ids

        visitor_completed  = [v for v in completed if not self.visitors.get(v['reidId'], {}).get('isStaff')]
        visitor_dwell_list = [v['dwellSeconds'] for v in visitor_completed if v['dwellSeconds'] >= MIN_DWELL_S]

        return {
            'timestamp':   datetime.now(timezone.utc).isoformat(),
            'activeCount': len(active),
            'active':      active,
            'today': {
                'date':              today,
                'uniqueVisitors':    len(visitor_ids),
                'staffCount':        len(staff_ids),
                'completedVisits':   len(visitor_completed),
                'avgDwellSeconds':   round(sum(visitor_dwell_list) / len(visitor_dwell_list)) if visitor_dwell_list else None,
                'maxDwellSeconds':   max(visitor_dwell_list) if visitor_dwell_list else None,
            },
        }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', help='Path to expo config JSON')
    parser.add_argument('--model',  default=str(SCRIPT_DIR / 'osnet_x0_25.onnx'))
    parser.add_argument('--interval', type=float, default=POLL_INTERVAL_S)
    args = parser.parse_args()

    # Câmeras a processar
    cam_ids = ['cam-1', 'cam-2', 'cam-3', 'cam-4']
    if args.config and os.path.exists(args.config):
        try:
            cfg = json.loads(open(args.config).read())
            cam_ids = [c['id'] for c in cfg.get('cameras', [])] or cam_ids
        except Exception:
            pass

    # Carregar modelo OSNet
    if not os.path.exists(args.model):
        print(f'[ReID] Modelo não encontrado: {args.model}')
        write_status('error', error='model not found')
        sys.exit(1)

    import onnxruntime as ort
    sess = ort.InferenceSession(args.model, providers=['CPUExecutionProvider'])
    print(f'[ReID] OSNet carregado: {args.model}')
    print(f'[ReID] SCRIPT_DIR={SCRIPT_DIR}', flush=True)
    print(f'[ReID] CWD={os.getcwd()}', flush=True)
    print(f'[ReID] output exists={os.path.exists(SCRIPT_DIR / "output")}', flush=True)
    print(f'[ReID] cam-2 det exists={os.path.exists(SCRIPT_DIR / "output" / "cam-2" / "detections.json")}', flush=True)
    print(f'[ReID] Câmeras: {cam_ids}')
    print(f'[ReID] Thresholds: same-zone={THRESH_SAME_ZONE} cross-zone={THRESH_CROSS_ZONE}')
    write_status('running', cameras=cam_ids, model=args.model)

    state = ReidState()
    cycle = 0

    # Restaurar estado preservado de restart mid-expo
    preserved_file = OUTPUT_DIR / 'reid-preserved.json'
    if preserved_file.exists():
        try:
            prev = json.loads(preserved_file.read_text())
            prev_date = prev.get('today', {}).get('date', '')
            today = state._brt_date()
            if prev_date == today:
                # Restaurar daily counters
                state.daily[today]['reid_ids'] = set()  # IDs não restauráveis, mas counts sim
                # Restaurar contadores via completed visits
                for v in prev.get('today', {}).get('completedVisits', 0) * [None]:
                    pass  # Visitantes finalizados não são restauráveis por design
                print(f"[ReID] Preserved state found for {today} — new session continues accumulating")
            else:
                print(f"[ReID] Preserved from {prev_date}, hoje={today} — ignorando")
        except Exception as e:
            print(f"[ReID] Could not read preserved: {e}")
        finally:
            preserved_file.unlink(missing_ok=True)

    while running:
        t0 = time.perf_counter()
        cycle += 1

        # Ler todas as câmeras
        cam_data = {}
        for cam_id in cam_ids:
            det, frame = read_camera(cam_id)
            cam_data[cam_id] = (det, frame)

        active_cams = sum(1 for det, _ in cam_data.values() if det is not None)

        # Debug: log a cada ciclo
        if cycle <= 5 or cycle % 30 == 0:
            det_counts = {k: (len(v[0].get('detections',[])) if v[0] else 'None') for k, v in cam_data.items()}
            print(f'[ReID] ciclo={cycle} cams_ativas={active_cams} dets={det_counts}', flush=True)

        # Atualizar estado ReID
        try:
            state.update(cam_data, sess)
            result = state.get_state()
            write_json(STATE_FILE, result)
        except Exception as e:
            import traceback
            print(f'[ReID] ERRO ciclo {cycle}: {e}', flush=True)
            traceback.print_exc()
            import sys; sys.stdout.flush(); sys.stderr.flush()

        elapsed = (time.perf_counter() - t0) * 1000
        if cycle % 30 == 0:
            s = state.get_state()
            print(f'[ReID] ciclo={cycle} active={s["activeCount"]} '
                  f'unique_hoje={s["today"]["uniqueVisitors"]} '
                  f'cameras_ativas={active_cams} elapsed={elapsed:.0f}ms')

        sleep = max(0, args.interval - (elapsed / 1000))
        time.sleep(sleep)

    write_status('stopped')
    # Salvar estado final
    try:
        write_json(STATE_FILE, state.get_state())
    except Exception:
        pass
    print('[ReID] Encerrado.')


if __name__ == '__main__':
    main()
