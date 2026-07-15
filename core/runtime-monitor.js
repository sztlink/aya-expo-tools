const { monitorEventLoopDelay } = require('perf_hooks');
const runtimeLog = require('./runtime-log');

const HEARTBEAT_INTERVAL = 5000;
const LAG_WARN_MS = 500;
const LAG_CRIT_MS = 2000;

let _timer = null;
let _histogram = null;
let _managers = {};
let _startedAt = null;
let _lastSnapshot = null;

function msFromNs(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value / 1e6) * 10) / 10;
}

function summarizeManagers() {
  const summary = {};

  if (_managers.scheduler?.getStatus) {
    const status = _managers.scheduler.getStatus();
    summary.scheduler = {
      enabled: !!_managers.scheduler.enabled,
      isOpen: status.isOpen,
      state: status.state || status.actualState || null,
      desiredState: status.desiredState || null,
      transition: status.transition || null,
      errors: status.errors || [],
      today: status.today,
      todaySchedule: status.todaySchedule || null,
      lastAction: status.lastAction || null,
      jobCount: status.jobCount || 0,
    };
  }

  if (_managers.portalSync?.getStatus) {
    summary.portalSync = _managers.portalSync.getStatus();
  }

  if (_managers.timelapse?.getStats) {
    summary.timelapse = _managers.timelapse.getStats();
  }

  if (_managers.serverHealth?.getStatus) {
    summary.serverHealth = _managers.serverHealth.getStatus();
  }

  if (_managers.cvManager?.getStatus) {
    const cv = _managers.cvManager.getStatus();
    summary.cv = {
      enabled: cv.enabled,
      running: cv.running,
      ready: cv.ready,
      cardinality: cv.cardinality || null,
      cameras: cv.cameras,
      totalCount: cv.totalCount,
      countStrategy: cv.countStrategy,
    };
  }

  if (_managers.cameras?.getAllStatus) {
    const cams = _managers.cameras.getAllStatus();
    summary.cameras = {
      total: cams.length,
      online: cams.filter(cam => cam.online).length,
    };
  }

  if (_managers.projectors?.getAllStatus) {
    const projectors = _managers.projectors.getAllStatus();
    summary.projectors = {
      total: projectors.length,
      online: projectors.filter(p => p.online).length,
    };
  }

  return summary;
}

function sample() {
  const memory = process.memoryUsage();
  const lag = {
    minMs: msFromNs(_histogram?.min || 0),
    meanMs: msFromNs(_histogram?.mean || 0),
    maxMs: msFromNs(_histogram?.max || 0),
    p99Ms: msFromNs(_histogram?.percentile ? _histogram.percentile(99) : 0),
  };

  const snapshot = {
    t: new Date().toISOString(),
    startedAt: _startedAt,
    pid: process.pid,
    uptimeSec: Math.floor(process.uptime()),
    memory: {
      rss: memory.rss,
      heapTotal: memory.heapTotal,
      heapUsed: memory.heapUsed,
      external: memory.external,
    },
    eventLoop: lag,
    managers: summarizeManagers(),
  };

  _lastSnapshot = snapshot;
  runtimeLog.writeJson('heartbeat.json', snapshot);

  if (lag.maxMs >= LAG_CRIT_MS || lag.p99Ms >= LAG_WARN_MS) {
    runtimeLog.appendJsonl('event-loop.jsonl', {
      ...lag,
      pid: process.pid,
      uptimeSec: snapshot.uptimeSec,
    });
  }

  if (_histogram?.reset) _histogram.reset();
}

module.exports = {
  start(managers = {}, intervalMs = HEARTBEAT_INTERVAL) {
    if (_timer) return;

    _managers = managers;
    _startedAt = new Date().toISOString();
    _histogram = monitorEventLoopDelay({ resolution: 20 });
    _histogram.enable();

    sample();
    _timer = setInterval(sample, intervalMs);
    if (_timer.unref) _timer.unref();

    console.log(`  🫀 Runtime monitor started (${intervalMs / 1000}s)`);
  },

  stop() {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
    if (_histogram) {
      try { _histogram.disable(); } catch { /* ignore */ }
      _histogram = null;
    }
  },

  getSnapshot() {
    return _lastSnapshot;
  },
};
