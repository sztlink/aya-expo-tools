"""
AYA Expo Tools — ReID (Re-Identification) v2
Lê crops de detecção, extrai features via OSNet, mantém galeria de identidades cross-camera.

Protocolo JSONL stdout:
  {"event": "ready", "model": "osnet_x0_25", "backend": "onnxruntime", ...}
  {"event": "match", "timestamp": "...", "reidId": "R001", "trackId": 42, "camera": "cam-1", ...}
  {"event": "new_identity", "timestamp": "...", "reidId": "R042", "camera": "cam-2", ...}
  {"event": "status", "uniqueVisitors": 127, "activeIdentities": 23, "staffFiltered": 5}
  {"event": "error", "message": "...", "retriable": true}

Features:
  - Config-driven thresholds (sameZone, crossZone)
  - Staff filter (HSV color + time threshold)
  - Spatial boost (same zone + recent = lower threshold)
  - Feature gallery (N features per reid_id)
  - Cross-camera tracking

Usage:
    python reid.py --config ../config/beleza-astral.json --camera-id cam-1
"""

import argparse
import json
import os
import sys
import time
import signal
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import defaultdict

import cv2
import numpy as np

# ─── Paths ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
BASE_OUTPUT_DIR = SCRIPT_DIR / "output"
REID_OUTPUT_DIR = BASE_OUTPUT_DIR / "reid"
REID_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ─── Shutdown ──────────────────────────────────────────────────────────────────

running = True


def signal_handler(sig, frame):
    global running
    running = False
    print("[ReID] Encerrando...", file=sys.stderr, flush=True)


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


# ─── JSONL Protocol ────────────────────────────────────────────────────────────

def emit(event: dict):
    """Emite evento JSONL no stdout. Node.js lê linha a linha."""
    print(json.dumps(event, ensure_ascii=False), flush=True)


def emit_status(**kwargs):
    """Emite evento de status periódico."""
    ts = datetime.now(timezone.utc).isoformat()
    emit({"event": "status", "timestamp": ts, **kwargs})


# ─── Config Parsing ────────────────────────────────────────────────────────────

def parse_config(config_path: str, camera_id: str) -> dict:
    """
    Carrega config JSON e extrai seções relevantes.
    Retorna dict com defaults para todos os valores.
    """
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    cv_config = config.get("cv", {})
    reid_config = cv_config.get("reid", {})
    staff_filter = cv_config.get("staffFilter", {})
    zones = cv_config.get("zones", [])

    return {
        "camera": camera_id,
        "enabled": reid_config.get("enabled", True),
        "model": reid_config.get("model", "osnet_x0_25"),
        "thresholds": {
            "sameZone": reid_config.get("thresholds", {}).get("sameZone", 0.4),
            "crossZone": reid_config.get("thresholds", {}).get("crossZone", 0.6),
        },
        "featureGallerySize": reid_config.get("featureGallerySize", 5),
        "spatialBoost": reid_config.get("spatialBoost", True),
        "matchInterval": reid_config.get("matchInterval", 1.0),
        "statusInterval": reid_config.get("statusInterval", 30.0),
        "staffFilter": {
            "enabled": staff_filter.get("enabled", False),
            "colorHSV": staff_filter.get("colorHSV", [120, 50, 50]),
            "colorRange": staff_filter.get("colorRange", [20, 80, 80]),
            "timeMinutes": staff_filter.get("timeMinutes", 15),
        },
        "zones": zones,
        "gpu": str(cv_config.get("gpu", 0)),
    }


def parse_zones(zones_config: list, camera_id: str) -> dict:
    """
    Deriva informações de zonas:
      - same_zone_cameras: dict {camId: [outros_camIds_na_mesma_zona]}
      - primary_zone: dict {camId: zoneId_primário}
    
    Zona primária = primeira zona com strategy:max onde a câmera aparece.
    Same-zone cameras = câmeras que compartilham zona com strategy:max.
    """
    same_zone_cameras = defaultdict(set)
    primary_zone = {}

    for zone in zones_config:
        strategy = zone.get("strategy", "max")
        cameras = zone.get("cameras", {})
        
        # Suporta cameras como dict ou array
        if isinstance(cameras, dict):
            cam_ids = list(cameras.keys())
        else:
            cam_ids = cameras if isinstance(cameras, list) else []

        # Only strategy:max zones create same-zone relationships
        if strategy == "max" and len(cam_ids) > 1:
            for cam in cam_ids:
                # Primary zone: first max zone where camera appears
                if cam not in primary_zone:
                    primary_zone[cam] = zone["id"]
                
                # Add all other cameras in this zone
                for other_cam in cam_ids:
                    if other_cam != cam:
                        same_zone_cameras[cam].add(other_cam)

    # Convert sets to lists
    same_zone_cameras = {k: list(v) for k, v in same_zone_cameras.items()}

    return {
        "same_zone_cameras": same_zone_cameras,
        "primary_zone": primary_zone,
    }


# ─── OSNet Model ───────────────────────────────────────────────────────────────

def load_osnet_model(model_name: str, gpu: str):
    """
    Carrega modelo OSNet via onnxruntime.
    Tenta GPU (CUDA), fallback para CPU.
    
    Returns: (session, backend_name)
    """
    try:
        import onnxruntime as ort
    except ImportError:
        raise RuntimeError("onnxruntime não instalado. Execute: pip install onnxruntime")

    model_path = SCRIPT_DIR / "models" / f"{model_name}.onnx"
    
    if not model_path.exists():
        raise FileNotFoundError(
            f"Modelo {model_name}.onnx não encontrado em {SCRIPT_DIR / 'models'}. "
            f"Baixe de: https://github.com/KaiyangZhou/deep-person-reid/releases"
        )

    # Tenta GPU primeiro
    providers = []
    backend = "cpu"
    
    try:
        if ort.get_device() == 'GPU' or 'CUDAExecutionProvider' in ort.get_available_providers():
            providers = [
                ('CUDAExecutionProvider', {
                    'device_id': int(gpu),
                    'cudnn_conv_algo_search': 'DEFAULT',
                }),
                'CPUExecutionProvider'
            ]
            backend = "onnxruntime-gpu"
        else:
            providers = ['CPUExecutionProvider']
            backend = "onnxruntime-cpu"
    except Exception:
        providers = ['CPUExecutionProvider']
        backend = "onnxruntime-cpu"

    session = ort.InferenceSession(str(model_path), providers=providers)
    
    # Verifica se GPU realmente ativou
    if backend == "onnxruntime-gpu":
        actual_provider = session.get_providers()[0]
        if 'CUDA' not in actual_provider:
            backend = "onnxruntime-cpu"
    
    return session, backend


def extract_feature(session, image: np.ndarray, input_size=(256, 128)) -> np.ndarray:
    """
    Extrai feature vector 512-dim de um crop de pessoa.
    
    Args:
        session: ONNX runtime session
        image: BGR image (crop da detecção)
        input_size: (height, width) esperado pelo modelo
    
    Returns:
        feature vector (512-dim, normalizado)
    """
    # Resize + normalize (ImageNet stats)
    img = cv2.resize(image, (input_size[1], input_size[0]))
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = img.astype(np.float32) / 255.0
    
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img = (img - mean) / std
    
    # CHW format + batch dimension
    img = np.transpose(img, (2, 0, 1))
    img = np.expand_dims(img, 0)
    
    # Inferência
    input_name = session.get_inputs()[0].name
    output = session.run(None, {input_name: img})[0]
    
    # Normaliza L2
    feature = output[0]
    feature = feature / (np.linalg.norm(feature) + 1e-12)
    
    return feature


def cosine_distance(feat1: np.ndarray, feat2: np.ndarray) -> float:
    """Distância cosseno entre dois features (0 = idêntico, 2 = oposto)."""
    return 1.0 - np.dot(feat1, feat2)


# ─── Staff Filter ──────────────────────────────────────────────────────────────

def check_staff_uniform(crop: np.ndarray, config: dict) -> bool:
    """
    Verifica se o crop corresponde ao uniforme de staff via HSV color matching.
    Usa upper-body crop (top 40% da bbox).
    
    Returns: True se parece com uniforme de staff
    """
    if not config.get("enabled", False):
        return False
    
    h, w = crop.shape[:2]
    upper_body = crop[0:int(h * 0.4), :]
    
    # Converte para HSV
    hsv = cv2.cvtColor(upper_body, cv2.COLOR_BGR2HSV)
    
    # Target color e range
    target = np.array(config["colorHSV"], dtype=np.uint8)
    color_range = np.array(config["colorRange"], dtype=np.uint8)
    
    lower = np.clip(target - color_range, 0, 255)
    upper = np.clip(target + color_range, 0, 255)
    
    # Threshold
    mask = cv2.inRange(hsv, lower, upper)
    ratio = np.count_nonzero(mask) / mask.size
    
    # Threshold from config (default 0.3 = 30% of upper-body matches color)
    uniform_threshold = config.get("uniformThreshold", 0.3)
    return ratio > uniform_threshold


# ─── ReID Gallery ──────────────────────────────────────────────────────────────

class ReIDGallery:
    """
    Mantém galeria de features por reid_id.
    Cada identidade armazena até N features (rolling buffer).
    """
    
    def __init__(self, max_features=5):
        self.max_features = max_features
        self.gallery = {}  # reid_id → list of (feature, timestamp, camera, zone)
        self.next_id = 1
        
        # Tracking para staff filter
        self.first_seen = {}  # reid_id → timestamp
        self.last_seen = {}   # reid_id → timestamp
        self.staff_ids = set()
    
    def add_identity(self, feature: np.ndarray, camera: str, zone: str = None) -> str:
        """Cria nova identidade e retorna reid_id."""
        reid_id = f"R{self.next_id:04d}"
        self.next_id += 1
        
        ts = datetime.now(timezone.utc)
        self.gallery[reid_id] = [(feature, ts, camera, zone)]
        self.first_seen[reid_id] = ts
        self.last_seen[reid_id] = ts
        
        return reid_id
    
    def add_feature(self, reid_id: str, feature: np.ndarray, camera: str, zone: str = None):
        """Adiciona feature a uma identidade existente."""
        ts = datetime.now(timezone.utc)
        
        if reid_id not in self.gallery:
            self.gallery[reid_id] = []
        
        self.gallery[reid_id].append((feature, ts, camera, zone))
        self.last_seen[reid_id] = ts
        
        # Rolling buffer
        if len(self.gallery[reid_id]) > self.max_features:
            self.gallery[reid_id] = self.gallery[reid_id][-self.max_features:]
    
    def find_match(self, feature: np.ndarray, camera: str, zone: str, 
                   same_zone_threshold: float, cross_zone_threshold: float,
                   same_zone_cameras: list, spatial_boost: bool) -> tuple:
        """
        Busca match na galeria.
        
        Returns: (reid_id, min_distance, is_match)
        """
        best_match = None
        min_distance = float('inf')
        
        now = datetime.now(timezone.utc)
        
        for reid_id, features in self.gallery.items():
            # Skip staff
            if reid_id in self.staff_ids:
                continue
            
            # Calcula distância média contra todas as features dessa identidade
            distances = []
            for feat, ts, feat_cam, feat_zone in features:
                dist = cosine_distance(feature, feat)
                distances.append(dist)
            
            if not distances:
                continue
            
            avg_dist = sum(distances) / len(distances)
            
            # Decide threshold baseado em contexto espacial
            last_feat_ts = features[-1][1]
            last_feat_cam = features[-1][2]
            
            # Same zone + recent = spatial boost
            is_same_zone = last_feat_cam in same_zone_cameras
            time_diff = (now - last_feat_ts).total_seconds()
            
            threshold = same_zone_threshold if is_same_zone else cross_zone_threshold
            
            # Spatial boost: reduz threshold em 20% se mesmo zona e < 30s
            if spatial_boost and is_same_zone and time_diff < 30:
                threshold *= 0.8
            
            # Match?
            if avg_dist < threshold and avg_dist < min_distance:
                min_distance = avg_dist
                best_match = reid_id
        
        is_match = best_match is not None
        return best_match, min_distance, is_match
    
    def mark_staff(self, reid_id: str):
        """Marca identidade como staff."""
        self.staff_ids.add(reid_id)
    
    def check_staff_by_time(self, reid_id: str, time_minutes: float) -> bool:
        """Verifica se identidade está presente há mais de X minutos (provável staff)."""
        if reid_id not in self.first_seen:
            return False
        
        elapsed = (datetime.now(timezone.utc) - self.first_seen[reid_id]).total_seconds() / 60
        return elapsed > time_minutes
    
    def get_active_identities(self, timeout_minutes=5) -> int:
        """Conta identidades vistas nos últimos N minutos."""
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(minutes=timeout_minutes)
        
        active = sum(1 for ts in self.last_seen.values() if ts > cutoff)
        return active
    
    def get_unique_visitors(self) -> int:
        """Total de identidades únicas (exceto staff)."""
        return len(self.gallery) - len(self.staff_ids)


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="AYA Expo Tools — ReID v2")
    parser.add_argument("--config", required=True, help="Path to expo config JSON")
    parser.add_argument("--camera-id", required=True, help="ID da câmera (ex: cam-1)")
    args = parser.parse_args()

    # Carrega config
    settings = parse_config(args.config, args.camera_id)
    zone_info = parse_zones(settings["zones"], settings["camera"])
    
    camera_id = settings["camera"]
    same_zone_cameras = zone_info["same_zone_cameras"].get(camera_id, [])
    primary_zone = zone_info["primary_zone"].get(camera_id, "unknown")

    if not settings["enabled"]:
        emit({"event": "error", "message": "ReID desabilitado no config", "retriable": False})
        print("[ReID] ReID desabilitado (cv.reid.enabled = false)", file=sys.stderr)
        sys.exit(0)

    print(f"[ReID] Iniciando para {camera_id}", file=sys.stderr, flush=True)
    print(f"[ReID] Zona primária: {primary_zone}", file=sys.stderr, flush=True)
    print(f"[ReID] Same-zone cameras: {same_zone_cameras}", file=sys.stderr, flush=True)

    # Carrega modelo OSNet
    print(f"[ReID] Carregando {settings['model']}...", file=sys.stderr, flush=True)
    try:
        session, backend = load_osnet_model(settings["model"], settings["gpu"])
        print(f"[ReID] Modelo pronto: {backend}", file=sys.stderr, flush=True)
    except Exception as e:
        emit({"event": "error", "message": f"Erro ao carregar modelo: {e}", "retriable": False})
        print(f"[ReID] Erro ao carregar modelo: {e}", file=sys.stderr)
        sys.exit(1)

    # Inicializa galeria
    gallery = ReIDGallery(max_features=settings["featureGallerySize"])

    # Emite ready
    emit({
        "event": "ready",
        "camera": camera_id,
        "model": settings["model"],
        "backend": backend,
        "thresholds": settings["thresholds"],
        "spatialBoost": settings["spatialBoost"],
        "sameZoneCameras": same_zone_cameras,
        "primaryZone": primary_zone,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    # ─── Loop de processamento ────────────────────────────────────────────────

    detector_output_dir = BASE_OUTPUT_DIR / camera_id
    last_status_time = time.time()
    status_interval = settings.get("statusInterval", 30.0)

    while running:
        loop_start = time.time()

        # Lê último frame do detector
        frame_file = detector_output_dir / "frame.jpg"
        detections_file = detector_output_dir / "detections.json"

        if not frame_file.exists() or not detections_file.exists():
            time.sleep(settings["matchInterval"])
            continue

        try:
            # Lê detecções
            with open(detections_file, "r") as f:
                det_data = json.load(f)
            
            frame = cv2.imread(str(frame_file))
            if frame is None:
                time.sleep(settings["matchInterval"])
                continue

            detections = det_data.get("detections", [])
            timestamp = det_data.get("timestamp", datetime.now(timezone.utc).isoformat())

            # Processa cada detecção
            for det in detections:
                try:
                    x, y, w, h = int(det["x"]), int(det["y"]), int(det["w"]), int(det["h"])
                except (KeyError, TypeError, ValueError):
                    continue
                track_id = det.get("trackId")
                zones = det.get("zones", [])
                
                # Bounds check + crop
                fh, fw = frame.shape[:2]
                x, y = max(0, x), max(0, y)
                w, h = min(w, fw - x), min(h, fh - y)
                if w <= 0 or h <= 0:
                    continue
                crop = frame[y:y+h, x:x+w]
                if crop.size == 0:
                    continue

                # Extrai feature
                try:
                    feature = extract_feature(session, crop)
                except Exception as e:
                    print(f"[ReID] Erro ao extrair feature: {e}", file=sys.stderr)
                    continue

                # Staff filter (uniform check)
                is_staff_uniform = check_staff_uniform(crop, settings["staffFilter"])

                # Busca match
                zone = zones[0] if zones else primary_zone
                reid_id, distance, is_match = gallery.find_match(
                    feature, camera_id, zone,
                    settings["thresholds"]["sameZone"],
                    settings["thresholds"]["crossZone"],
                    same_zone_cameras,
                    settings["spatialBoost"]
                )

                if is_match:
                    # Match encontrado
                    gallery.add_feature(reid_id, feature, camera_id, zone)
                    
                    # Staff filter (time-based) — só roda se staffFilter.enabled=true
                    is_staff_time = (
                        settings["staffFilter"]["enabled"]
                        and gallery.check_staff_by_time(
                            reid_id, settings["staffFilter"]["timeMinutes"]
                        )
                    )
                    
                    is_staff = is_staff_uniform or is_staff_time
                    if is_staff and reid_id not in gallery.staff_ids:
                        gallery.mark_staff(reid_id)
                        print(f"[ReID] {reid_id} marcado como staff", file=sys.stderr)
                    
                    emit({
                        "event": "match",
                        "timestamp": timestamp,
                        "reidId": reid_id,
                        "trackId": track_id,
                        "camera": camera_id,
                        "zone": zone,
                        "confidence": round(1.0 - distance, 3),
                        "distance": round(distance, 3),
                        "staff": is_staff,
                    })
                else:
                    # Nova identidade
                    reid_id = gallery.add_identity(feature, camera_id, zone)
                    
                    is_staff = is_staff_uniform
                    if is_staff:
                        gallery.mark_staff(reid_id)
                    
                    emit({
                        "event": "new_identity",
                        "timestamp": timestamp,
                        "reidId": reid_id,
                        "trackId": track_id,
                        "camera": camera_id,
                        "zone": zone,
                        "staff": is_staff,
                    })

        except Exception as e:
            print(f"[ReID] Erro no loop: {e}", file=sys.stderr, flush=True)
            emit({"event": "error", "message": str(e), "retriable": True})

        # Status periódico
        if time.time() - last_status_time > status_interval:
            emit_status(
                uniqueVisitors=gallery.get_unique_visitors(),
                activeIdentities=gallery.get_active_identities(),
                staffFiltered=len(gallery.staff_ids),
                camera=camera_id,
            )
            last_status_time = time.time()

        # Sleep
        elapsed = time.time() - loop_start
        sleep_time = max(0, settings["matchInterval"] - elapsed)
        if sleep_time > 0:
            time.sleep(sleep_time)

    # ─── Cleanup ───────────────────────────────────────────────────────────────

    emit_status(
        uniqueVisitors=gallery.get_unique_visitors(),
        activeIdentities=0,
        staffFiltered=len(gallery.staff_ids),
        camera=camera_id,
        status="stopped",
    )
    print("[ReID] Encerrado.", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
