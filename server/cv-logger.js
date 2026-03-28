/**
 * AYA Expo Tools — CV Daily Logger
 *
 * Samples zone counts every minute and persists to daily JSONL files.
 * At midnight, consolidates a daily summary with counter + zones + peaks.
 *
 * Files produced:
 *   logs/cv/YYYY-MM-DD.jsonl        — minute-by-minute zone samples
 *   logs/cv/daily/YYYY-MM-DD.json   — daily summary (counter + zones + peaks)
 *
 * Usage:
 *   const cvLogger = require('./cv-logger');
 *   cvLogger.start(cvManager, config);
 *   cvLogger.stop();
 */

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs', 'cv');
const DAILY_DIR = path.join(LOGS_DIR, 'daily');

let _timer = null;
let _midnightTimer = null;
let _cvManager = null;
let _currentDate = null;
let _schedule = null;
let _openingDate = null; // "YYYY-MM-DD" — só conta dados a partir dessa data

// ═══ Ensure directories ═════════════════════════════════════════════════════
function ensureDirs() {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.mkdirSync(DAILY_DIR, { recursive: true });
}

// ═══ Today string ════════════════════════════════════════════════════════════
function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function nowISO() {
  return new Date().toISOString();
}

// ═══ Filter: is sample in opening hours? ═════════════════════════════════════
function isSampleInOpenHours(isoTimestamp, schedule) {
  if (!schedule || !schedule.enabled) return true;
  
  // Parse timestamp in São Paulo timezone
  const date = new Date(isoTimestamp);
  // Convert to São Paulo time (UTC-3)
  const spTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayKey = dayNames[spTime.getDay()];
  const dayCfg = schedule.days?.[dayKey];
  
  if (!dayCfg) return false; // closed today
  
  const openStr = dayCfg.open || schedule.powerOn || '09:00';
  const closeStr = dayCfg.close || schedule.powerOff || '20:00';
  
  const [openH, openM] = openStr.split(':').map(Number);
  const [closeH, closeM] = closeStr.split(':').map(Number);
  
  const currentMinutes = spTime.getHours() * 60 + spTime.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

// ═══ Sample: snapshot of zones + counter → append to JSONL ═══════════════════
function sample() {
  if (!_cvManager) return;

  try {
    const status = _cvManager.getStatus();
    if (!status.running) return;

    const entry = {
      t: nowISO(),
      total: status.totalCount,
      zones: status.zones,                    // { "sala-imersiva": 3, "galeria": 1, ... }
      perCamera: {},
    };

    // Per-camera counts (lighter than full status)
    for (const [camId, cam] of Object.entries(status.perCamera || {})) {
      entry.perCamera[camId] = cam.count;
    }

    // Dwell time per zone
    if (status.dwell && Object.keys(status.dwell).length > 0) {
      entry.dwell = status.dwell;
    }

    // Counter data
    if (status.counter && status.counter.entries !== undefined) {
      entry.counter = {
        entries: status.counter.entries,
        exits: status.counter.exits,
        occupancy: status.counter.occupancy,
      };
      if (status.counter.hourly) {
        entry.counterHourly = status.counter.hourly;
      }
    }

    // Append to daily JSONL
    const date = today();
    const file = path.join(LOGS_DIR, `${date}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');

    // Day changed? Consolidate yesterday
    if (_currentDate && _currentDate !== date) {
      consolidate(_currentDate);
    }
    _currentDate = date;

  } catch (e) {
    // Silently ignore — logger should never crash the server
    console.error(`[CV Logger] Sample error: ${e.message}`);
  }
}

// ═══ Consolidate: daily summary from JSONL ═══════════════════════════════════
function consolidate(date) {
  const file = path.join(LOGS_DIR, `${date}.jsonl`);
  if (!fs.existsSync(file)) return null;

  try {
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n')
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);

    if (lines.length === 0) return null;

    // Filter to open hours only (public visitors, not montagem)
    const publicLines = _schedule
      ? lines.filter(l => isSampleInOpenHours(l.t, _schedule))
      : lines;

    // Also skip dates before openingDate
    if (_openingDate && date < _openingDate) {
      console.log(`[CV Logger] ${date} is before openingDate ${_openingDate} — skipping public stats`);
      // Still save summary but mark as pre-opening
    }

    // ═══ Counter final — use MAX entries/exits seen across all PUBLIC samples ═══
    // (handles restarts: counter may reset mid-day, we want cumulative max)
    let maxEntries = 0, maxExits = 0;
    let lastHourly = {};
    for (const l of publicLines) {
      if (l.counter) {
        if (l.counter.entries > maxEntries) maxEntries = l.counter.entries;
        if (l.counter.exits > maxExits) maxExits = l.counter.exits;
        if (l.counterHourly && Object.keys(l.counterHourly).length > 0) {
          lastHourly = l.counterHourly;
        }
      }
    }
    const counterFinal = { entries: maxEntries, exits: maxExits, occupancy: Math.max(0, maxEntries - maxExits) };
    const counterHourly = lastHourly;

    // ═══ Zone stats (using PUBLIC samples only) ═══
    const zoneIds = Object.keys(publicLines[0]?.zones || {});
    const zoneStats = {};

    for (const zoneId of zoneIds) {
      const values = publicLines.map(l => l.zones?.[zoneId] ?? 0);
      const nonZero = values.filter(v => v > 0);

      zoneStats[zoneId] = {
        max: Math.max(...values),
        avg: values.length > 0 ? +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : 0,
        minutesOccupied: nonZero.length,           // each sample = 1 minute
        minutesTotal: values.length,
        occupancyRate: values.length > 0
          ? +((nonZero.length / values.length) * 100).toFixed(1)
          : 0,
      };
    }

    // ═══ Total stats (using PUBLIC samples only) ═══
    const totals = publicLines.map(l => l.total || 0);
    const peak = Math.max(...totals);
    const peakEntry = publicLines.find(l => (l.total || 0) === peak);
    const peakTime = peakEntry?.t || null;

    // ═══ Hourly breakdown (from PUBLIC zone samples) ═══
    const hourlyZones = {};
    for (const entry of publicLines) {
      const hour = entry.t.slice(11, 13);
      if (!hourlyZones[hour]) hourlyZones[hour] = { samples: 0, total: 0, zones: {} };
      hourlyZones[hour].samples++;
      hourlyZones[hour].total += entry.total || 0;
      for (const [zoneId, count] of Object.entries(entry.zones || {})) {
        if (!hourlyZones[hour].zones[zoneId]) hourlyZones[hour].zones[zoneId] = 0;
        hourlyZones[hour].zones[zoneId] += count;
      }
    }
    // Average per hour
    for (const [hour, data] of Object.entries(hourlyZones)) {
      data.avgTotal = +(data.total / data.samples).toFixed(1);
      for (const zoneId of Object.keys(data.zones)) {
        data.zones[zoneId] = +(data.zones[zoneId] / data.samples).toFixed(1);
      }
      delete data.total;
    }

    // ═══ Dwell time per zone (last non-empty dwell from PUBLIC samples) ═══
    const dwellStats = {};
    for (const l of [...publicLines].reverse()) {
      if (l.dwell) {
        for (const [zoneId, stats] of Object.entries(l.dwell)) {
          if (!dwellStats[zoneId] && stats.samples > 0) {
            dwellStats[zoneId] = stats;
          }
        }
      }
      // Stop once we have all zones
      if (Object.keys(dwellStats).length >= zoneIds.length) break;
    }

    const summary = {
      date,
      samples: lines.length,                    // total samples (all day)
      publicSamples: publicLines.length,        // samples in opening hours only
      firstSample: lines[0].t,
      lastSample: lines[lines.length - 1].t,
      counter: counterFinal,
      counterHourly,
      peak: { count: peak, time: peakTime },
      zones: zoneStats,
      dwell: dwellStats,
      hourly: hourlyZones,
    };

    // ReID — visitantes únicos e dwell real (se disponível para este dia)
    try {
      const reidFile = path.join(__dirname, '..', 'cv', 'output', 'reid', 'state.json');
      if (fs.existsSync(reidFile)) {
        const reidState = JSON.parse(fs.readFileSync(reidFile, 'utf8'));
        if (reidState.today && reidState.today.date === date) {
          const t = reidState.today;
          summary.reid = {
            uniqueVisitors:  t.uniqueVisitors  || 0,
            completedVisits: t.completedVisits || 0,
            avgDwellSeconds: t.avgDwellSeconds || null,
            maxDwellSeconds: t.maxDwellSeconds || null,
          };
        }
      }
    } catch { /* reid opcional */ }

    // Save
    const summaryFile = path.join(DAILY_DIR, `${date}.json`);
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`[CV Logger] Daily summary saved: ${summaryFile} (${publicLines.length}/${lines.length} public samples)`);

    return summary;

  } catch (e) {
    console.error(`[CV Logger] Consolidate error for ${date}: ${e.message}`);
    return null;
  }
}

// ═══ Schedule midnight consolidation ═════════════════════════════════════════
function scheduleMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 5, 0); // 00:00:05 next day (5s buffer)
  const ms = midnight.getTime() - now.getTime();

  _midnightTimer = setTimeout(() => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    console.log(`[CV Logger] Midnight consolidation: ${yesterday}`);
    consolidate(yesterday);
    scheduleMidnight(); // schedule next
  }, ms);

  console.log(`[CV Logger] Next midnight consolidation in ${Math.round(ms / 60000)}min`);
}

// ═══ Public API ══════════════════════════════════════════════════════════════

function start(cvManager, config, intervalMs = 60000) {
  _cvManager = cvManager;
  _schedule = config?.schedule || null;
  _openingDate = config?.exhibition?.openingDate || null;
  _currentDate = today();
  ensureDirs();

  // Sample every minute
  _timer = setInterval(sample, intervalMs);

  // Schedule midnight consolidation
  scheduleMidnight();

  console.log(`[CV Logger] Started — sampling every ${intervalMs / 1000}s → logs/cv/`);
  if (_schedule && _schedule.enabled) {
    console.log(`[CV Logger] Filtering public samples by schedule (${Object.keys(_schedule.days || {}).length} days)`);
  }
  if (_openingDate) {
    console.log(`[CV Logger] Opening date: ${_openingDate} (data before this is ignored)`);
  }
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  if (_midnightTimer) { clearTimeout(_midnightTimer); _midnightTimer = null; }

  // Consolidate current day on stop (partial day)
  if (_currentDate) {
    consolidate(_currentDate);
  }

  console.log('[CV Logger] Stopped');
}

/**
 * Get daily summary (today or specific date).
 * If today, generates on-the-fly from JSONL.
 */
function getDailySummary(date) {
  date = date || today();

  // If requesting today, consolidate on-the-fly
  if (date === today()) {
    return consolidate(date);
  }

  // Otherwise, read from saved file
  const file = path.join(DAILY_DIR, `${date}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/**
 * List available daily summaries
 */
function listDays() {
  ensureDirs();
  // Check both JSONL (raw) and daily (consolidated)
  const jsonlDates = fs.readdirSync(LOGS_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => f.replace('.jsonl', ''));

  const dailyDates = fs.readdirSync(DAILY_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));

  const allDates = [...new Set([...jsonlDates, ...dailyDates])].sort().reverse();

  return allDates.map(date => {
    const jsonlFile = path.join(LOGS_DIR, `${date}.jsonl`);
    const dailyFile = path.join(DAILY_DIR, `${date}.json`);
    return {
      date,
      hasRaw: fs.existsSync(jsonlFile),
      hasSummary: fs.existsSync(dailyFile),
      rawSizeKB: fs.existsSync(jsonlFile) ? Math.round(fs.statSync(jsonlFile).size / 1024) : 0,
    };
  });
}

module.exports = { start, stop, sample, consolidate, getDailySummary, listDays };
