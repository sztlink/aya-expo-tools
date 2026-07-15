const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');

function ensureLogDir() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

function safeReplacer(_key, value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof value === 'bigint') return Number(value);
  return value;
}

function normalizeEntry(entry = {}) {
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    return {
      t: entry.t || new Date().toISOString(),
      ...entry,
    };
  }

  return {
    t: new Date().toISOString(),
    message: String(entry || ''),
  };
}

function appendJsonl(filename, entry, opts = {}) {
  try {
    ensureLogDir();
    const filePath = path.join(LOG_DIR, filename);
    const line = JSON.stringify(normalizeEntry(entry), safeReplacer) + '\n';
    if (opts.sync) fs.appendFileSync(filePath, line);
    else fs.appendFile(filePath, line, () => {});
  } catch {
    // never crash runtime logging
  }
}

function writeJson(filename, data, opts = {}) {
  try {
    ensureLogDir();
    const filePath = path.join(LOG_DIR, filename);
    const json = JSON.stringify(data, safeReplacer, 2);
    if (opts.sync) fs.writeFileSync(filePath, json);
    else fs.writeFile(filePath, json, () => {});
  } catch {
    // never crash runtime logging
  }
}

module.exports = {
  LOG_DIR,
  appendJsonl,
  writeJson,
};
