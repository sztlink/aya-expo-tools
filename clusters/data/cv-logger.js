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
 *   cvLogger.start(cvManager);
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
const _dtfCache = new Map();

// ── Ensure directories ──────────────────────────────────────────────
function ensureDirs() {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.mkdirSync(DAILY_DIR, { recursive: true });
}

// ── Timezone helpers ────────────────────────────────────────────────
function getTimezone() {
  return _cvManager?.config?.schedule?.timezone || 'America/Sao_Paulo';
}

function getFormatter(timeZone) {
  if (!_dtfCache.has(timeZone)) {
    _dtfCache.set(timeZone, new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }));
  }
  return _dtfCache.get(timeZone);
}

function getZonedParts(dateLike = new Date(), timeZone = getTimezone()) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return { date: null, hour: null };

  const parts = Object.fromEntries(
    getFormatter(timeZone)
      .formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );

  return {
    date: parts.year && parts.month && parts.day ? `${parts.year}-${parts.month}-${parts.day}` : null,
    hour: parts.hour || null,
  };
}

// ── Today string ────────────────────────────────────────────────────
function today() {
  return getZonedParts(new Date()).date;
}

function nowISO() {
  return new Date().toISOString();
}

function positiveCounterDelta(current, previous) {
  const curr = Number.isFinite(current) ? current : 0;
  const prev = Number.isFinite(previous) ? previous : 0;
  return curr >= prev ? (curr - prev) : curr;
}

// ── Sample: snapshot of zones + counter → append to JSONL ───────────
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

function readEntriesForDate(date) {
  ensureDirs();
  const files = fs.readdirSync(LOGS_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .sort();

  const entries = [];
  for (const name of files) {
    const file = path.join(LOGS_DIR, name);
    const raw = fs.readFileSync(file, 'utf8').trim();
    if (!raw) continue;

    for (const line of raw.split('\n')) {
      try {
        const entry = JSON.parse(line);
        if (!entry?.t) continue;
        if (getZonedParts(entry.t).date === date) {
          entries.push(entry);
        }
      } catch {
        // ignore malformed line
      }
    }
  }

  return entries.sort((a, b) => String(a.t).localeCompare(String(b.t)));
}

// ── Consolidate: daily summary from JSONL ───────────────────────────
function consolidate(date) {
  try {
    const lines = readEntriesForDate(date);
    if (lines.length === 0) return null;

    // ── Counter final — derive DAILY deltas from consecutive samples ──
    // Handles three cases:
    // 1) counter starts the day already > 0 (carry-over from previous day) → baseline ignored
    // 2) counter grows normally during the day → accumulate positive deltas
    // 3) counter resets mid-day/restart → negative jump, so current value becomes the new delta
    const counterLines = lines.filter(l => l.counter && (
      l.counter.entries !== undefined || l.counter.exits !== undefined
    ));

    let dailyEntries = 0;
    let dailyExits = 0;
    const counterHourly = {};
    const firstCounter = counterLines[0]?.counter || {};
    let peakEntries = Number.isFinite(firstCounter.entries) ? firstCounter.entries : 0;
    let peakExits = Number.isFinite(firstCounter.exits) ? firstCounter.exits : 0;

    for (let i = 1; i < counterLines.length; i++) {
      const current = counterLines[i];
      const currentEntries = Number.isFinite(current.counter?.entries) ? current.counter.entries : 0;
      const currentExits = Number.isFinite(current.counter?.exits) ? current.counter.exits : 0;
      const hour = getZonedParts(current.t).hour || '00';
      if (!counterHourly[hour]) counterHourly[hour] = { entries: 0, exits: 0 };

      const hardEntriesReset = currentEntries < (peakEntries - 20) && currentEntries <= Math.max(5, Math.floor(peakEntries * 0.5));
      const hardExitsReset = currentExits < (peakExits - 20) && currentExits <= Math.max(5, Math.floor(peakExits * 0.5));

      if (hardEntriesReset) peakEntries = currentEntries;
      if (hardExitsReset) peakExits = currentExits;

      const deltaEntries = currentEntries > peakEntries ? (currentEntries - peakEntries) : 0;
      const deltaExits = currentExits > peakExits ? (currentExits - peakExits) : 0;

      dailyEntries += deltaEntries;
      dailyExits += deltaExits;
      counterHourly[hour].entries += deltaEntries;
      counterHourly[hour].exits += deltaExits;

      if (currentEntries > peakEntries) peakEntries = currentEntries;
      if (currentExits > peakExits) peakExits = currentExits;
    }

    const counterFinal = {
      entries: dailyEntries,
      exits: dailyExits,
      occupancy: Math.max(0, dailyEntries - dailyExits),
    };

    // ── Zone stats ──
    const zoneIds = Object.keys(lines[0].zones || {});
    const zoneStats = {};

    for (const zoneId of zoneIds) {
      const values = lines.map(l => l.zones?.[zoneId] ?? 0);
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

    // ── Total stats ──
    const totals = lines.map(l => l.total || 0);
    const peak = Math.max(...totals);
    const peakEntry = lines.find(l => (l.total || 0) === peak);
    const peakTime = peakEntry?.t || null;

    // ── Hourly breakdown (from zone samples) ──
    const hourlyZones = {};
    for (const entry of lines) {
      const hour = getZonedParts(entry.t).hour || '00';
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

    // ── Dwell time per zone (last non-empty dwell from samples) ──
    const dwellStats = {};
    for (const l of [...lines].reverse()) {
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
      samples: lines.length,
      firstSample: lines[0].t,
      lastSample: lines[lines.length - 1].t,
      counter: counterFinal,
      counterHourly,
      peak: { count: peak, time: peakTime },
      zones: zoneStats,
      dwell: dwellStats,
      hourly: hourlyZones,
    };

    // Save
    const summaryFile = path.join(DAILY_DIR, `${date}.json`);
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`[CV Logger] Daily summary saved: ${summaryFile} (${lines.length} samples)`);

    return summary;

  } catch (e) {
    console.error(`[CV Logger] Consolidate error for ${date}: ${e.message}`);
    return null;
  }
}

// ── Schedule midnight consolidation ─────────────────────────────────
function scheduleMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 5, 0); // 00:00:05 next day (5s buffer)
  const ms = midnight.getTime() - now.getTime();

  _midnightTimer = setTimeout(() => {
    const yesterday = getZonedParts(new Date(Date.now() - 86400000)).date;
    console.log(`[CV Logger] Midnight consolidation: ${yesterday}`);
    consolidate(yesterday);
    scheduleMidnight(); // schedule next
  }, ms);

  console.log(`[CV Logger] Next midnight consolidation in ${Math.round(ms / 60000)}min`);
}

// ── Public API ──────────────────────────────────────────────────────

function start(cvManager, intervalMs = 60000) {
  _cvManager = cvManager;
  _currentDate = today();
  ensureDirs();

  // Sample every minute
  _timer = setInterval(sample, intervalMs);

  // Schedule midnight consolidation
  scheduleMidnight();

  console.log(`[CV Logger] Started — sampling every ${intervalMs / 1000}s → logs/cv/`);
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

  const rawFiles = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.jsonl')).sort();
  const rawDates = new Set();

  for (const name of rawFiles) {
    const file = path.join(LOGS_DIR, name);
    const raw = fs.readFileSync(file, 'utf8').trim();
    if (!raw) continue;

    for (const line of raw.split('\n')) {
      try {
        const entry = JSON.parse(line);
        const date = entry?.t ? getZonedParts(entry.t).date : null;
        if (date) rawDates.add(date);
      } catch {
        // ignore malformed line
      }
    }
  }

  const dailyDates = fs.readdirSync(DAILY_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));

  const allDates = [...new Set([...rawDates, ...dailyDates])].sort().reverse();

  return allDates.map(date => {
    const summary = getDailySummary(date);
    return {
      date,
      hasRaw: rawDates.has(date),
      hasSummary: !!summary,
      rawSizeKB: rawFiles.reduce((total, name) => {
        const file = path.join(LOGS_DIR, name);
        const raw = fs.readFileSync(file, 'utf8').trim();
        if (!raw) return total;
        let containsDate = false;
        for (const line of raw.split('\n')) {
          try {
            const entry = JSON.parse(line);
            if (entry?.t && getZonedParts(entry.t).date === date) {
              containsDate = true;
              break;
            }
          } catch {}
        }
        return containsDate ? total + Math.round(fs.statSync(file).size / 1024) : total;
      }, 0),
    };
  });
}

module.exports = { start, stop, sample, consolidate, getDailySummary, listDays };
