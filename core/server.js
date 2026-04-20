// core/server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

// ─── Log Functions ─────────────────────────────────────────
const LOG_PATH = path.join(__dirname, '..', 'config', 'log.json');

// Cache em memória — evita readFileSync/writeFileSync a cada addLogEntry
let _logCache = null;

function readLog() {
  if (_logCache) return [..._logCache]; // retorna cópia para evitar mutação externa
  if (!fs.existsSync(LOG_PATH)) { _logCache = []; return []; }
  try {
    _logCache = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
    return [..._logCache];
  } catch { _logCache = []; return []; }
}

function writeLog(entries) {
  _logCache = entries.slice(0, 200); // mantém cache sincronizado
  // Escrita assíncrona — não bloqueia event loop
  fs.writeFile(LOG_PATH, JSON.stringify(entries, null, 2), () => {});
}

function addLogEntry(message, type = 'system') {
  if (!_logCache) readLog(); // inicializa cache se necessário
  _logCache.unshift({ message, type, timestamp: new Date().toISOString() });
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

// ─── Start Server ──────────────────────────────────────────
function start(config, { app, server }, managers = {}) {
  const PORT = config?.server?.port || 3000;
  const HOST = config?.server?.host || '0.0.0.0';

  server.listen(PORT, HOST, () => {
    console.log(`  🌐 http://localhost:${PORT}`);
    console.log(`  🌐 http://${config?.exhibition?.network?.mediaServer || 'localhost'}:${PORT}\n`);

    // Start managers if provided
    if (managers.projectors) managers.projectors.startPolling(config.pjlink?.pollInterval || 30000);
    if (managers.cameras) managers.cameras.startPolling(30000);
    if (managers.scheduler) managers.scheduler.start();
    if (managers.serverHealth) managers.serverHealth.start();
    if (managers.portalSync) managers.portalSync.start();
    if (managers.cvManager) {
      managers.cvManager.start();
      if (managers.cvLogger) managers.cvLogger.start(managers.cvManager);
    }
    if (managers.timelapse) managers.timelapse.start();
  });

  // Uncaught errors — log but don't crash
  process.on('uncaughtException', (err) => {
    console.error(`  ❌ Uncaught exception: ${err.message}`);
    console.error(err.stack);
  });
  process.on('unhandledRejection', (reason) => {
    console.error(`  ❌ Unhandled rejection: ${reason}`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n  Shutting down...');
    if (managers.projectors) managers.projectors.stopPolling();
    if (managers.cameras) managers.cameras.stopPolling();
    if (managers.scheduler) managers.scheduler.stop();
    if (managers.portalSync) managers.portalSync.stop();
    if (managers.cvLogger) managers.cvLogger.stop();
    if (managers.cvManager) managers.cvManager.stop();
    if (managers.serverHealth) managers.serverHealth.stop();
    if (managers.timelapse) managers.timelapse.stop();
    server.close();
    process.exit(0);
  });
}

module.exports = {
  createApp,
  start,
  session,
  addLogEntry,
  readLog,
  writeLog,
  broadcast,
};
