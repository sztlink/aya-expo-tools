// core/server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const runtimeLog = require('./runtime-log');

function loadReleaseIdentity() {
  try {
    const releasePath = path.join(__dirname, '..', 'release.json');
    if (!fs.existsSync(releasePath)) return null;
    const manifest = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
    return manifest.releaseId || manifest.commit || null;
  } catch {
    return null;
  }
}
const RUNTIME_RELEASE = loadReleaseIdentity();

// ─── Log Functions ─────────────────────────────────────────
const LOG_PATH = path.join(__dirname, '..', 'config', 'log.json');

// Cache em memória — evita readFileSync/writeFileSync a cada addLogEntry
let _logCache = null;

function normalizeLogEntry(messageOrEntry, type = 'system', meta = {}) {
  if (messageOrEntry && typeof messageOrEntry === 'object' && !Array.isArray(messageOrEntry)) {
    return {
      timestamp: new Date().toISOString(),
      type: 'system',
      ...messageOrEntry,
      message: String(messageOrEntry.message || ''),
    };
  }

  return {
    message: String(messageOrEntry || ''),
    type,
    timestamp: new Date().toISOString(),
    ...(meta && typeof meta === 'object' ? meta : {}),
  };
}

function readLog() {
  if (_logCache) return [..._logCache]; // retorna cópia para evitar mutação externa
  if (!fs.existsSync(LOG_PATH)) { _logCache = []; return []; }
  try {
    _logCache = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
    return [..._logCache];
  } catch { _logCache = []; return []; }
}

function writeLog(entries) {
  _logCache = entries.slice(0, 200).map(entry => normalizeLogEntry(entry)); // mantém cache sincronizado
  // Escrita assíncrona — não bloqueia event loop
  fs.writeFile(LOG_PATH, JSON.stringify(_logCache, null, 2), () => {});
}

function addLogEntry(messageOrEntry, type = 'system', meta = {}) {
  if (!_logCache) readLog(); // inicializa cache se necessário
  _logCache.unshift(normalizeLogEntry(messageOrEntry, type, meta));
  if (_logCache.length > 200) _logCache.splice(200);
  // Escrita assíncrona — não bloqueia event loop
  fs.writeFile(LOG_PATH, JSON.stringify(_logCache, null, 2), () => {});
}

// ─── Session Manager ───────────────────────────────────────
const session = {
  active: false,
  startedAt: null,
  startedBy: null,
};

// ─── Helper Functions ──────────────────────────────────────
function isRemoteCommand(req) {
  // Comandos do portal vêm com header X-Remote-Command
  return req.headers['x-remote-command'] === 'true';
}

// Rotas que são bloqueadas quando sessão está ativa e comando é remoto
const DESTRUCTIVE_PATHS = [
  '/api/projectors/all/off',
  '/api/projectors/all/on',
];
// Padrão regex para rotas individuais de projetores
const PROJECTOR_CMD_RE = /^\/api\/projectors\/[^/]+\/(on|off)$/;

// ─── WebSocket Setup ───────────────────────────────────────
let wss;
const clients = new Set();

function broadcast(type, data) {
  if (!wss) return;
  const msg = JSON.stringify({ type, data, time: Date.now() });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

// ─── Create Express App ────────────────────────────────────
function createApp(config) {
  const app = express();
  const server = http.createServer(app);

  // Middleware
  app.use(express.json({ limit: '10mb' }));

  // Telemetria de requests HTTP (somente API)
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) return next();

    const startedAt = Date.now();
    const startedIso = new Date(startedAt).toISOString();
    const remote = req.socket?.remoteAddress || null;
    let finished = false;

    const inflightTimer = setTimeout(() => {
      if (finished || res.writableEnded) return;
      runtimeLog.appendJsonl('http-slow.jsonl', {
        phase: 'in-flight',
        method: req.method,
        path: req.originalUrl || req.url,
        startedAt: startedIso,
        durationMs: Date.now() - startedAt,
        remote,
      });
    }, 10000);
    if (inflightTimer.unref) inflightTimer.unref();

    const finalize = (phase) => {
      if (finished) return;
      finished = true;
      clearTimeout(inflightTimer);

      const durationMs = Date.now() - startedAt;
      const payload = {
        phase,
        method: req.method,
        path: req.originalUrl || req.url,
        startedAt: startedIso,
        durationMs,
        statusCode: res.statusCode,
        remote,
      };

      if (phase !== 'finish' || res.statusCode >= 500) {
        runtimeLog.appendJsonl('http-errors.jsonl', payload);
      } else if (durationMs >= 1000) {
        runtimeLog.appendJsonl('http-slow.jsonl', payload);
      }
    };

    res.on('finish', () => finalize('finish'));
    res.on('close', () => {
      if (!res.writableEnded) finalize('close');
    });

    next();
  });

  // Local liveness is intentionally independent from Internet, Portal and hardware.
  // The external watchdog uses HTTP responsiveness + heartbeat freshness.
  app.get('/api/runtime/live', (_req, res) => {
    const heartbeatPath = path.join(runtimeLog.LOG_DIR, 'heartbeat.json');
    let heartbeatUpdatedAt = null;
    let heartbeatAgeMs = null;
    let heartbeat = null;
    try {
      const stat = fs.statSync(heartbeatPath);
      heartbeatUpdatedAt = stat.mtime.toISOString();
      heartbeatAgeMs = Math.max(0, Date.now() - stat.mtimeMs);
      heartbeat = JSON.parse(fs.readFileSync(heartbeatPath, 'utf8'));
    } catch { /* heartbeat starts after managers initialize */ }

    const readinessErrors = [];
    const operationalWarnings = [];
    if (heartbeat?.pid !== process.pid) readinessErrors.push(`heartbeat-pid:${heartbeat?.pid || 'missing'}!=${process.pid}`);
    if (heartbeatAgeMs == null) readinessErrors.push('heartbeat-missing');
    else if (heartbeatAgeMs > 45000) readinessErrors.push(`heartbeat-stale:${Math.round(heartbeatAgeMs)}ms`);

    let startupResult = null;
    try {
      const startupPath = path.join(runtimeLog.LOG_DIR, 'startup.json');
      if (fs.existsSync(startupPath)) startupResult = JSON.parse(fs.readFileSync(startupPath, 'utf8'));
    } catch { /* startup receipt is diagnostic only */ }
    if (startupResult?.pid === process.pid && startupResult.ok === false) {
      for (const error of startupResult.errors || []) {
        operationalWarnings.push(`startup:${error.name || 'manager'}:${error.error || 'failed'}`);
      }
    }

    const managerState = heartbeat?.managers || {};
    const schedulerState = managerState.scheduler || null;
    if (!schedulerState) {
      readinessErrors.push('scheduler-missing');
    } else if (schedulerState.transition) {
      readinessErrors.push(`scheduler-transition:${schedulerState.transition.action}`);
    } else if (schedulerState.state === 'unknown') {
      readinessErrors.push('scheduler-unknown');
    } else if (schedulerState.state !== schedulerState.desiredState) {
      const degradedApplied = schedulerState.state === 'degraded'
        && schedulerState.isOpen === (schedulerState.desiredState === 'open');
      if (degradedApplied) operationalWarnings.push('scheduler-degraded');
      else readinessErrors.push(`scheduler-state:${schedulerState.state}->${schedulerState.desiredState}`);
    }

    const desiredState = schedulerState?.desiredState;
    const cvState = managerState.cv;
    const timelapseState = managerState.timelapse;
    if (desiredState === 'open') {
      if (cvState?.enabled && !cvState.running) readinessErrors.push('cv-not-running');
      else if (cvState?.enabled && !cvState.ready) readinessErrors.push('cv-not-ready');
      if (timelapseState && !timelapseState.running) readinessErrors.push('timelapse-not-running');
    } else if (desiredState === 'closed') {
      if (cvState?.running) readinessErrors.push('cv-running-while-closed');
      if (timelapseState?.running) readinessErrors.push('timelapse-running-while-closed');
    }

    const portalState = managerState.portalSync;
    if (portalState?.enabled && !portalState.running) operationalWarnings.push('portal-sync-not-running');

    res.json({
      status: 'alive',
      ready: readinessErrors.length === 0,
      readinessErrors,
      operationalWarnings,
      pid: process.pid,
      uptimeSec: Math.floor(process.uptime()),
      heartbeatUpdatedAt,
      heartbeatAgeMs,
      scheduler: schedulerState ? {
        state: schedulerState.state,
        desiredState: schedulerState.desiredState,
      } : null,
      release: RUNTIME_RELEASE,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Auth Middleware (Story 4-5) ──────────────────────────
  const AYA_TOKEN = process.env.AYA_TOKEN;
  
  app.use((req, res, next) => {
    // Skip auth if no token configured (dev mode)
    if (!AYA_TOKEN) return next();
    
    // Skip auth for static files (no /api prefix)
    if (!req.path.startsWith('/api')) return next();
    
    // Skip auth for public routes
    if (req.path === '/api/health' || req.path.startsWith('/setup')) {
      return next();
    }
    
    // Check X-AYA-Token header
    const token = req.headers['x-aya-token'];
    if (!token || token !== AYA_TOKEN) {
      return res.status(401).json({
        ok: false,
        error: 'Auth required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    next();
  });

  // Serve index.html with token injection
  app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, '..', 'ui', 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');
    
    // Inject token as meta tag if configured
    if (AYA_TOKEN) {
      // Sanitiza AYA_TOKEN para evitar quebra de HTML (XSS via atributo)
      const safeToken = AYA_TOKEN.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html = html.replace(
        '</head>',
        `  <meta name="aya-token" content="${safeToken}">\n</head>`
      );
    }
    
    res.send(html);
  });

  app.use(express.static(path.join(__dirname, '..', 'ui')));

  // Middleware: bloqueia comandos remotos destrutivos durante sessão ativa
  app.use((req, res, next) => {
    if (!session.active || !isRemoteCommand(req)) return next();
    if (req.method !== 'POST') return next();

    const isDestructive = DESTRUCTIVE_PATHS.includes(req.path) || PROJECTOR_CMD_RE.test(req.path);
    if (isDestructive) {
      return res.status(423).json({
        error: 'Sessão ativa — comandos remotos bloqueados',
        session: { active: true, startedAt: session.startedAt, startedBy: session.startedBy },
      });
    }
    next();
  });

  // Static: config files (plants, pixelmaps)
  app.use('/files', express.static(path.join(__dirname, '..', 'config')));

  // Static: media files (videos for TV cast)
  const MEDIA_DIR = path.join(__dirname, '..', 'media');
  app.use('/media', express.static(MEDIA_DIR, {
    maxAge: '1h',
    acceptRanges: true,
  }));

  // Loops — pre-concatenated videos on D: drive (11h seamless)
  const LOOPS_DIR = 'D:\\aya-expo-data\\loops';
  if (fs.existsSync(LOOPS_DIR)) {
    app.use('/loops', express.static(LOOPS_DIR, {
      maxAge: '1h',
      acceptRanges: true,
    }));
    console.log('  🔁 Loop files served from D:\\aya-expo-data\\loops\\');
  }

  // Setup WebSocket
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    clients.add(ws);
    // Send initial state will be done by the caller after managers are initialized
    ws.on('close', () => clients.delete(ws));
  });

  return { app, server };
}

function logRuntimeError(type, errLike) {
  const err = errLike instanceof Error ? errLike : new Error(String(errLike || type));
  runtimeLog.appendJsonl('runtime-errors.jsonl', {
    type,
    pid: process.pid,
    uptimeSec: Math.floor(process.uptime()),
    message: err.message,
    stack: err.stack,
    memory: process.memoryUsage(),
  }, { sync: true });
}

// ─── Start Server ──────────────────────────────────────────
async function startManagers(config, managers = {}) {
  const results = [];
  const errors = [];

  const invoke = async (name, manager, method, ...args) => {
    if (!manager || typeof manager[method] !== 'function') return null;
    try {
      const result = await manager[method](...args);
      results.push({ name, method, result });
      if (result && result.ok === false) {
        errors.push({ name, method, error: result.error || result.message || `${name}.${method} returned ok:false` });
      }
      return result;
    } catch (err) {
      errors.push({ name, method, error: err.message });
      console.error(`  ❌ ${name}.${method} failed: ${err.message}`);
      return null;
    }
  };

  // Always-on managers. Report/health/Portal telemetry can start before the
  // physical reconciliation; PJLink/camera polling starts afterwards to avoid
  // racing immediate polls with open/close commands.
  await invoke('data', managers.data, 'start'); // report cron only; CV logging is scheduled
  await invoke('serverHealth', managers.serverHealth, 'start');
  await invoke('portalSync', managers.portalSync, 'start');
  await invoke('runtimeMonitor', managers.runtimeMonitor, 'start', managers);

  // Scheduler owns the boot reconciliation before any immediate hardware poll.
  await invoke('scheduler', managers.scheduler, 'start');
  await invoke('projectors', managers.projectors, 'startPolling', config?.pjlink?.pollInterval || 30000);
  await invoke('cameras', managers.cameras, 'startPolling', 30000);

  return { ok: errors.length === 0, results, errors };
}

function start(config, { app, server }, managers = {}) {
  const PORT = config?.server?.port || 3000;
  const HOST = config?.server?.host || '0.0.0.0';
  let resolveStartup;
  let rejectStartup;
  const startup = new Promise((resolve, reject) => {
    resolveStartup = resolve;
    rejectStartup = reject;
  });

  server.once('error', rejectStartup);
  server.listen(PORT, HOST, () => {
    server.removeListener('error', rejectStartup);
    console.log(`  🌐 http://localhost:${PORT}`);
    console.log(`  🌐 http://${config?.exhibition?.network?.mediaServer || 'localhost'}:${PORT}\n`);

    startManagers(config, managers).then(result => {
      const startupResult = { ...result, pid: process.pid, completedAt: new Date().toISOString() };
      runtimeLog.writeJson('startup.json', startupResult, { sync: true });
      resolveStartup(startupResult);
    }, rejectStartup);
  });

  let shuttingDown = false;
  const shutdown = async (exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n  Shutting down (exit ${exitCode})...`);

    const stopManager = async (name, manager, method) => {
      if (!manager || typeof manager[method] !== 'function') return;
      try { await manager[method](); }
      catch (err) { console.error(`  ❌ ${name}.${method} failed during shutdown: ${err.message}`); }
    };

    const cleanup = async () => {
      await stopManager('scheduler', managers.scheduler, 'stop');
      await stopManager('projectors', managers.projectors, 'stopPolling');
      await stopManager('cameras', managers.cameras, 'stopPolling');
      await stopManager('portalSync', managers.portalSync, 'stop');
      await stopManager('runtimeMonitor', managers.runtimeMonitor, 'stop');
      await stopManager('timelapse', managers.timelapse, 'stop');
      if (managers.data && typeof managers.data.stop === 'function') {
        await stopManager('data', managers.data, 'stop');
      } else {
        await stopManager('cvLogger', managers.cvLogger, 'stop');
      }
      await stopManager('cvManager', managers.cvManager, 'stop');
      await stopManager('serverHealth', managers.serverHealth, 'stop');

      await new Promise(resolve => {
        if (!server.listening) return resolve();
        try { server.close(resolve); } catch { resolve(); }
      });
    };

    let timedOut = false;
    await Promise.race([
      cleanup(),
      new Promise(resolve => setTimeout(() => { timedOut = true; resolve(); }, 15000)),
    ]);
    if (timedOut) {
      logRuntimeError('shutdownTimeout', new Error('Graceful shutdown exceeded 15 seconds'));
      console.error('  ❌ Graceful shutdown timed out; forcing process exit');
    }
    process.exit(exitCode);
  };

  // Continuing after an uncaught error can leave equipment ownership ambiguous.
  // Exit non-zero so Task Scheduler and the external watchdog can recover cleanly.
  process.on('uncaughtException', (err) => {
    logRuntimeError('uncaughtException', err);
    console.error(`  ❌ Uncaught exception: ${err.message}`);
    console.error(err.stack);
    void shutdown(1);
  });
  process.on('unhandledRejection', (reason) => {
    logRuntimeError('unhandledRejection', reason);
    console.error(`  ❌ Unhandled rejection: ${reason}`);
    void shutdown(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => { void shutdown(0); });
  process.on('SIGTERM', () => { void shutdown(0); });

  return { server, startup, shutdown };
}

module.exports = {
  createApp,
  start,
  startManagers,
  session,
  addLogEntry,
  readLog,
  writeLog,
  broadcast,
};
