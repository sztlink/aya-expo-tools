/**
 * Smoke test — verifica que o server inicia e todas as rotas principais respondem.
 * Roda com: node --test test/smoke.test.js
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { fork } = require('child_process');
const path = require('path');

let server;

function get(route) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${route}`, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

describe('Smoke Test', () => {
  before(async () => {
    server = fork(path.join(__dirname, '..', 'index.js'), ['--config=beleza-astral'], {
      stdio: 'pipe',
      cwd: path.join(__dirname, '..')
    });
    // Wait for server to start
    await new Promise(r => setTimeout(r, 4000));
  });

  after(() => {
    if (server) server.kill();
  });

  const routes = [
    '/api/health',
    '/api/schedule',
    '/api/projectors',
    '/api/cameras',
    '/api/cv/status',
    '/api/reid/stats',
    '/api/tv',
    '/api/server/health',
    '/api/setup/state',
    '/api/config',
    '/'
  ];

  for (const route of routes) {
    it(`GET ${route} responde 200`, async () => {
      const res = await get(route);
      assert.strictEqual(res.status, 200, `${route} retornou ${res.status}`);
    });
  }
});
