'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 500 * 1024 * 1024;
const DEFAULT_RETENTION_DAYS = 21;

function localDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

class RollingLog {
  constructor(directory, streamName, opts = {}) {
    this.directory = directory;
    this.streamName = streamName;
    this.maxBytes = opts.maxBytes || DEFAULT_MAX_BYTES;
    this.maxTotalBytes = opts.maxTotalBytes || DEFAULT_MAX_TOTAL_BYTES;
    this.retentionDays = opts.retentionDays || DEFAULT_RETENTION_DAYS;
    this.date = null;
    this.sequence = 0;
    this.bytes = 0;
    this.filePath = null;
    fs.mkdirSync(directory, { recursive: true });
    this.prune();
  }

  _openFor(date) {
    if (this.date !== date) {
      this.date = date;
      this.sequence = 0;
    }
    do {
      this.sequence++;
      this.filePath = path.join(this.directory, `${this.streamName}-${date}-${String(this.sequence).padStart(3, '0')}.log`);
      this.bytes = fs.existsSync(this.filePath) ? fs.statSync(this.filePath).size : 0;
    } while (this.bytes >= this.maxBytes);
  }

  write(chunk, now = new Date()) {
    try {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      const date = localDate(now);
      if (!this.filePath || this.date !== date || this.bytes + buffer.length > this.maxBytes) {
        this.prune(now.getTime());
        this._openFor(date);
      }
      fs.appendFileSync(this.filePath, buffer);
      this.bytes += buffer.length;
      this.lastError = null;
      return true;
    } catch (err) {
      this.lastError = err;
      return false;
    }
  }

  prune(now = Date.now()) {
    let files;
    try {
      files = fs.readdirSync(this.directory)
        .filter(name => new RegExp(`^(stdout|stderr)-\\d{4}-\\d{2}-\\d{2}-\\d{3}\\.log$`).test(name))
        .map(name => {
          const filePath = path.join(this.directory, name);
          const stat = fs.statSync(filePath);
          return { filePath, mtimeMs: stat.mtimeMs, size: stat.size };
        })
        .sort((a, b) => a.mtimeMs - b.mtimeMs);
    } catch {
      return;
    }

    const cutoff = now - this.retentionDays * 86400000;
    for (const file of [...files]) {
      if (file.mtimeMs >= cutoff) continue;
      try { fs.unlinkSync(file.filePath); } catch { /* best effort */ }
    }

    files = files.filter(file => fs.existsSync(file.filePath));
    let total = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files) {
      if (total <= this.maxTotalBytes) break;
      try {
        fs.unlinkSync(file.filePath);
        total -= file.size;
      } catch { /* best effort */ }
    }
  }
}

function parseConfig(argv) {
  const direct = argv.find(arg => arg.startsWith('--config='));
  if (direct) return direct.slice('--config='.length).replace(/^"|"$/g, '');
  const index = argv.indexOf('--config');
  return index >= 0 ? argv[index + 1] : null;
}

function appendLauncher(message) {
  try {
    const logDir = path.join(ROOT, 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, 'launcher.log');
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > 5 * 1024 * 1024) {
      const archive = path.join(logDir, `launcher-${Date.now()}.log`);
      fs.renameSync(logPath, archive);
      const archives = fs.readdirSync(logDir)
        .filter(name => /^launcher-\d+\.log$/.test(name))
        .sort()
        .reverse();
      for (const stale of archives.slice(5)) {
        try { fs.unlinkSync(path.join(logDir, stale)); } catch { /* best effort */ }
      }
    }
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);
  } catch {
    // Logging failure must not hide the child process exit code.
  }
}

function main() {
  const config = parseConfig(process.argv.slice(2)) || 'template-amano-rio';
  const runtimeDir = path.join(ROOT, 'logs', 'runtime');
  const reportsDir = path.join(ROOT, 'logs', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const stdoutLog = new RollingLog(runtimeDir, 'stdout');
  const stderrLog = new RollingLog(runtimeDir, 'stderr');
  const childArgs = [
    '--report-uncaught-exception',
    '--report-on-fatalerror',
    `--report-directory=${reportsDir}`,
    path.join(ROOT, 'index.js'),
    `--config=${config}`,
  ];

  appendLauncher(`start config=${config} launcherPid=${process.pid}`);
  let child;
  try {
    child = spawn(process.execPath, childArgs, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: process.env,
    });
  } catch (err) {
    stderrLog.write(`${new Date().toISOString()} launcher spawn error: ${err.stack || err.message}\n`);
    appendLauncher('exit code=1 reason=spawn-throw');
    process.exit(1);
  }

  child.stdout.on('data', chunk => stdoutLog.write(chunk));
  child.stderr.on('data', chunk => stderrLog.write(chunk));

  let stopping = false;
  const forward = signal => {
    if (stopping) return;
    stopping = true;
    appendLauncher(`signal=${signal} childPid=${child.pid}`);
    try { child.kill(signal); } catch { /* task stop may have killed it already */ }
  };
  process.on('SIGINT', () => forward('SIGINT'));
  process.on('SIGTERM', () => forward('SIGTERM'));

  let settled = false;
  const finish = (code, signal, reason = 'close') => {
    if (settled) return;
    settled = true;
    const exitCode = Number.isInteger(code) ? code : 1;
    appendLauncher(`exit code=${exitCode} signal=${signal || '-'} reason=${reason} childPid=${child.pid}`);
    stdoutLog.prune();
    stderrLog.prune();
    process.exit(exitCode);
  };

  child.on('error', err => {
    stderrLog.write(`${new Date().toISOString()} launcher child error: ${err.stack || err.message}\n`);
    // A failed spawn normally emits close afterwards; keep a bounded fallback.
    setTimeout(() => finish(1, null, 'spawn-error-timeout'), 1000);
  });
  // close fires after stdout/stderr streams close, so no tail bytes are lost.
  child.on('close', (code, signal) => finish(code, signal));
}

if (require.main === module) main();

module.exports = { RollingLog, localDate, parseConfig };
