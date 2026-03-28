/**
 * AYA Expo Tools — Frame Capture para ReID
 *
 * Salva 1 frame por câmera a cada INTERVAL segundos,
 * SOMENTE quando há pessoas detectadas.
 *
 * Política de armazenamento:
 *   - Drive D: preferencial (fallback: pasta local)
 *   - Circular buffer: quando D: livre < FREE_THRESHOLD_GB → deleta dia mais antigo
 *   - Segunda-feira: loga aviso "frames prontos para pickup do Leonardo"
 *
 * Estrutura:
 *   D:\aya-expo-data\frames\YYYY-MM-DD\cam-X\HHMMSS.jpg
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const BASE_DIR        = fs.existsSync('D:\\aya-expo-data')
  ? 'D:\\aya-expo-data\\frames'
  : path.join(__dirname, '..', 'logs', 'frames');

const INTERVAL_MS     = 10_000;   // 10s entre capturas
const FREE_THRESHOLD_GB = 100;    // limpar quando D: livre < 100GB
const TZ              = 'America/Sao_Paulo';

// ── Helpers de data em BRT ──────────────────────────────────────────────────

function brtDateStr(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

function brtTimeStr(d = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(d).replace(/:/g, '');
}

function brtDayOfWeek(d = new Date()) {
  // 0=Sun, 1=Mon, ...
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d);
}

// ── Espaço livre no drive D: ────────────────────────────────────────────────

async function getDriveFreeGB() {
  try {
    const stat = await fs.promises.statfs(BASE_DIR.slice(0, 3)); // "D:\"
    return (stat.bfree * stat.bsize) / (1024 ** 3);
  } catch {
    return Infinity; // se não conseguir checar, não limpar
  }
}

// ── Circular buffer: apaga o dia mais antigo ────────────────────────────────

function deleteOldestDay() {
  try {
    if (!fs.existsSync(BASE_DIR)) return;
    const days = fs.readdirSync(BASE_DIR)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort(); // mais antigo primeiro
    if (days.length === 0) return;
    const oldest = path.join(BASE_DIR, days[0]);
    fs.rmSync(oldest, { recursive: true, force: true });
    console.log(`[FrameCapture] Circular buffer: deletado ${days[0]} (D: < ${FREE_THRESHOLD_GB}GB livres)`);
    return days[0];
  } catch (e) {
    console.error('[FrameCapture] Erro ao deletar dia antigo:', e.message);
  }
}

// ── Classe principal ─────────────────────────────────────────────────────────

class FrameCapture {
  /**
   * @param {object} cameras  — CameraManager (mesma interface do timelapse)
   * @param {object} cvManager — CVManager (para ler contagem de detecções)
   */
  constructor(cameras, cvManager) {
    this.cameras   = cameras;
    this.cvManager = cvManager;
    this._timer    = null;
    this._running  = false;
    this._stats    = { captures: 0, errors: 0, skipped: 0, cleaned: 0 };
    this._lastPickupLog = null;
  }

  start() {
    if (this._timer) return;
    try { fs.mkdirSync(BASE_DIR, { recursive: true }); } catch {}
    console.log(`[FrameCapture] Iniciado — intervalo ${INTERVAL_MS / 1000}s, threshold ${FREE_THRESHOLD_GB}GB`);
    console.log(`[FrameCapture] Base dir: ${BASE_DIR}`);

    // Primeira captura após 15s (deixa câmeras estabilizarem)
    setTimeout(() => this._capture(), 15_000);
    this._timer = setInterval(() => this._capture(), INTERVAL_MS);
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  getStats() { return { ...this._stats, baseDir: BASE_DIR }; }

  async _capture() {
    if (this._running) return;
    this._running = true;

    try {
      // Verificar se há alguém no espaço
      const status = this.cvManager.getStatus();
      const totalCount = status?.totalCount ?? 0;

      if (totalCount === 0) {
        this._stats.skipped++;
        this._running = false;
        return;
      }

      // Checar espaço livre e limpar se necessário
      const freeGB = await getDriveFreeGB();
      if (freeGB < FREE_THRESHOLD_GB) {
        const deleted = deleteOldestDay();
        if (deleted) this._stats.cleaned++;
      }

      // Data/hora em BRT
      const now     = new Date();
      const dateStr = brtDateStr(now);
      const timeStr = brtTimeStr(now);

      // Capturar frame de cada câmera com detecção
      const perCamera = status?.perCamera ?? {};
      const allCams   = this.cameras.getAllStatus();

      for (const camStatus of allCams) {
        if (!camStatus.online) continue;

        // Priorizar câmeras com detecção, mas salvar todas se totalCount > 0
        const camCount = perCamera[camStatus.id]?.count ?? 0;
        if (camCount === 0 && totalCount > 0) continue; // só câmeras com pessoa

        const cam = this.cameras.get(camStatus.id);
        if (!cam) continue;

        const camDir = path.join(BASE_DIR, dateStr, camStatus.id);
        try {
          fs.mkdirSync(camDir, { recursive: true });
          const buffer = await cam.getSnapshot(false); // SD — suficiente para ReID
          if (!buffer || buffer.length < 1000) continue;

          fs.writeFileSync(path.join(camDir, `${timeStr}.jpg`), buffer);
          this._stats.captures++;
        } catch (e) {
          this._stats.errors++;
        }
      }

      // Segunda-feira: lembrete de pickup para o Leonardo
      this._maybeLogPickupReminder(now, dateStr);

    } catch (e) {
      console.error('[FrameCapture] Erro inesperado:', e.message);
    }

    this._running = false;
  }

  _maybeLogPickupReminder(now, dateStr) {
    if (brtDayOfWeek(now) !== 'Mon') return;
    if (this._lastPickupLog === dateStr) return; // já logou hoje

    this._lastPickupLog = dateStr;

    // Contar dias disponíveis no drive
    let days = [];
    try {
      days = fs.readdirSync(BASE_DIR)
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort();
    } catch {}

    const totalMB = days.reduce((acc, day) => {
      try {
        const dayPath = path.join(BASE_DIR, day);
        const size = fs.readdirSync(dayPath, { recursive: true, withFileTypes: true })
          .filter(f => f.isFile())
          .reduce((s, f) => {
            try { return s + fs.statSync(path.join(f.parentPath || f.path, f.name)).size; } catch { return s; }
          }, 0);
        return acc + size;
      } catch { return acc; }
    }, 0) / (1024 * 1024);

    console.log(
      `[FrameCapture] 📦 PICKUP MONDAY — ${days.length} dias disponíveis ` +
      `(${days[0] || '?'} → ${days[days.length - 1] || '?'}), ` +
      `~${Math.round(totalMB)}MB. Leonardo: copiar D:\\aya-expo-data\\frames\\ para HD externo → 4090 AYA Studio.`
    );
  }
}

module.exports = { FrameCapture };
