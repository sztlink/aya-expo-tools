/**
 * AYA Expo Tools — Timelapse / Frame Capture adaptativo
 *
 * Dois modos baseados no horário da expo (schedule do config):
 *   ABERTA  → 1fps  — dados para CV/ReID
 *   FECHADA → 1/min — documentação visual
 *
 * Circular buffer: quando D: livre < FREE_THRESHOLD_GB → deleta dia mais antigo.
 *
 * Segunda-feira: loga aviso de pickup para o Leonardo (HD externo → 4090 AYA Studio).
 *
 * Estrutura: D:\aya-expo-data\timelapse\YYYY-MM-DD\cam-X\HHMMSS.jpg
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const BASE_DIR = fs.existsSync('D:\\aya-expo-data\\timelapse')
  ? 'D:\\aya-expo-data\\timelapse'
  : path.join(__dirname, '..', 'logs', 'timelapse');

const INTERVAL_OPEN_MS   = 1_000;   // 1fps quando expo aberta
const INTERVAL_CLOSED_MS = 60_000;  // 1/min quando fechada
const FREE_THRESHOLD_GB  = 100;     // circular buffer threshold
const TZ                 = 'America/Sao_Paulo';

// ── Helpers de data/hora em BRT ─────────────────────────────────────────────

function brtDateStr(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

function brtTimeStr(d = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(d).replace(/:/g, '');
}

function brtDayOfWeek(d = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d); // 'Mon', 'Tue', ...
}

// ── Schedule: expo aberta? ───────────────────────────────────────────────────

function isExpoOpen(schedule) {
  if (!schedule || !schedule.enabled) return true; // sem schedule = sempre aberta

  const now     = new Date();
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const tzDate  = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
  const dayKey  = dayNames[tzDate.getDay()];
  const dayCfg  = (schedule.days || {})[dayKey];

  if (!dayCfg) return false; // fechado hoje

  const [oh, om] = (dayCfg.open  || schedule.powerOn  || '09:00').split(':').map(Number);
  const [ch, cm] = (dayCfg.close || schedule.powerOff || '20:00').split(':').map(Number);

  const hhmm = tzDate.getHours() * 60 + tzDate.getMinutes();
  return hhmm >= oh * 60 + om && hhmm < ch * 60 + cm;
}

// ── Circular buffer ──────────────────────────────────────────────────────────

async function freeGB() {
  try {
    const stat = await fs.promises.statfs(BASE_DIR.slice(0, 3));
    return (stat.bfree * stat.bsize) / 1073741824;
  } catch { return Infinity; }
}

function deleteOldestDay() {
  try {
    const days = fs.readdirSync(BASE_DIR)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    if (!days.length) return null;
    const oldest = path.join(BASE_DIR, days[0]);
    fs.rmSync(oldest, { recursive: true, force: true });
    console.log(`[Timelapse] Circular buffer: removido ${days[0]} (D: < ${FREE_THRESHOLD_GB}GB)`);
    return days[0];
  } catch (e) {
    console.error('[Timelapse] Erro ao remover dia antigo:', e.message);
    return null;
  }
}

// ── Classe principal ─────────────────────────────────────────────────────────

class TimelapseCapture {
  /**
   * @param {object} cameras   — CameraManager
   * @param {object} [opts]
   * @param {object} [opts.schedule] — schedule do config (beleza-astral.json)
   */
  constructor(cameras, opts = {}) {
    this.cameras   = cameras;
    this.schedule  = opts.schedule || null;
    this._timer    = null;
    this._capturing = false;
    this._stats    = { started: null, captures: 0, errors: 0, lastCapture: null, mode: 'init' };
    this._lastPickupLog = null;
  }

  start() {
    if (this._timer) return;
    try { fs.mkdirSync(BASE_DIR, { recursive: true }); } catch {}
    this._stats.started = new Date().toISOString();
    console.log('[Timelapse] Iniciado — modo adaptativo (1fps aberta / 1/min fechada)');
    setTimeout(() => this._tick(), 10_000); // primeira captura após 10s
  }

  stop() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }

  getStats() { return { ...this._stats }; }

  async _tick() {
    const open = isExpoOpen(this.schedule);
    const nextMs = open ? INTERVAL_OPEN_MS : INTERVAL_CLOSED_MS;
    this._stats.mode = open ? 'open-1fps' : 'closed-1min';

    await this._capture(open);

    this._timer = setTimeout(() => this._tick(), nextMs);
  }

  async _capture(isOpen) {
    if (this._capturing) return;
    this._capturing = true;

    try {
      // Circular buffer — verificar espaço apenas a cada 100 capturas (open) ou sempre (closed)
      if (!isOpen || this._stats.captures % 100 === 0) {
        const free = await freeGB();
        if (free < FREE_THRESHOLD_GB) await deleteOldestDay();
      }

      const now     = new Date();
      const dateStr = brtDateStr(now);
      const timeStr = brtTimeStr(now);

      const allCams = this.cameras.getAllStatus();

      for (const camStatus of allCams) {
        if (!camStatus.online) continue;
        const cam = this.cameras.get(camStatus.id);
        if (!cam) continue;

        const camDir = path.join(BASE_DIR, dateStr, camStatus.id);
        try {
          fs.mkdirSync(camDir, { recursive: true });
          const buffer = await cam.getSnapshot(false);
          if (!buffer || buffer.length < 1000) continue;
          fs.writeFileSync(path.join(camDir, `${timeStr}.jpg`), buffer);
          this._stats.captures++;
          this._stats.lastCapture = now.toISOString();
        } catch {
          this._stats.errors++;
        }
      }

      // Segunda-feira: lembrete pickup Leonardo
      this._maybeLogPickup(now, dateStr);

    } catch (e) {
      console.error('[Timelapse] Erro inesperado:', e.message);
    }

    this._capturing = false;
  }

  _maybeLogPickup(now, dateStr) {
    if (brtDayOfWeek(now) !== 'Mon') return;
    if (this._lastPickupLog === dateStr) return;
    this._lastPickupLog = dateStr;
    try {
      const days = fs.readdirSync(BASE_DIR)
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
      console.log(
        `[Timelapse] PICKUP SEGUNDA — ${days.length} dias (${days[0]} → ${days[days.length - 1]}). ` +
        `Leonardo: copiar D:\\aya-expo-data\\timelapse\\ para HD externo → 4090 AYA Studio.`
      );
    } catch {}
  }

  // ── API de consulta (mantida intacta) ──────────────────────────────────────

  getDates() {
    try {
      return fs.readdirSync(BASE_DIR)
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
    } catch { return []; }
  }

  getFrames(date, camId) {
    const dir = path.join(BASE_DIR, date, camId);
    try {
      return fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).sort().map(f => ({
        time: `${f.slice(0,2)}:${f.slice(2,4)}:${f.slice(4,6)}`,
        file: f,
        path: path.join(dir, f),
      }));
    } catch { return []; }
  }

  getCameras(date) {
    try {
      return fs.readdirSync(path.join(BASE_DIR, date))
        .filter(d => d.startsWith('cam-')).sort();
    } catch { return []; }
  }

  getFrame(date, camId, filename) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    if (!/^cam-\d+$/.test(camId)) return null;
    if (!/^\d{6}\.jpg$/.test(filename)) return null;
    try { return fs.readFileSync(path.join(BASE_DIR, date, camId, filename)); } catch { return null; }
  }

  getFrameAt(date, camId, time) {
    const target = time.replace(/:/g, '');
    const frames = this.getFrames(date, camId);
    if (!frames.length) return null;
    return frames.reduce((best, f) => {
      const diff = Math.abs(parseInt(f.file) - parseInt(target));
      const bestDiff = Math.abs(parseInt(best.file) - parseInt(target));
      return diff < bestDiff ? f : best;
    });
  }

  getStorageStats() {
    const dates = this.getDates();
    let totalFiles = 0, totalBytes = 0;
    for (const date of dates.slice(0, 7)) {
      for (const cam of this.getCameras(date)) {
        const frames = this.getFrames(date, cam);
        totalFiles += frames.length;
        if (frames.length > 0) {
          try { totalBytes += fs.statSync(frames[0].path).size * frames.length; } catch {}
        }
      }
    }
    return {
      dates: dates.length,
      files7d: totalFiles,
      estimatedMB7d: Math.round(totalBytes / 1048576),
      estimatedMBPerDay: dates.length > 0 ? Math.round(totalBytes / Math.min(dates.length, 7) / 1048576) : 0,
      mode: this._stats.mode,
    };
  }
}

module.exports = { TimelapseCapture };
