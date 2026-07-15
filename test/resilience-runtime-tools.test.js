'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { RollingLog, parseConfig } = require('../scripts/runtime-launcher');
const { buildManifest } = require('../scripts/release-manifest');
const { assertSafeOutput } = require('../scripts/build-release-package');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aya-resilience-'));
}

test('runtime launcher parses config and rotates without losing bytes', () => {
  assert.equal(parseConfig(['--config=template-amano-brasilia']), 'template-amano-brasilia');
  assert.equal(parseConfig(['--config', 'other']), 'other');

  const dir = tempDir();
  const log = new RollingLog(dir, 'stdout', { maxBytes: 10, maxTotalBytes: 1000, retentionDays: 30 });
  log.write('12345678', new Date('2026-07-14T12:00:00Z'));
  log.write('ABCDEFGH', new Date('2026-07-14T12:00:01Z'));

  const files = fs.readdirSync(dir).sort();
  assert.equal(files.length, 2);
  assert.equal(files.map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join(''), '12345678ABCDEFGH');
});

test('release package refuses source roots and broad output directories', () => {
  const root = path.resolve('/safe/source');
  assert.throws(() => assertSafeOutput(root, root), /Unsafe package output/);
  assert.throws(() => assertSafeOutput(root, path.resolve('/safe')), /Unsafe package output/);
  assert.throws(() => assertSafeOutput(root, path.resolve('/tmp')), /Unsafe package output/);
  assert.doesNotThrow(() => assertSafeOutput(root, path.join(root, 'dist', 'release')));
  assert.doesNotThrow(() => assertSafeOutput(root, path.resolve('/tmp/aya-expo-tools-amano-package')));
});

test('release manifest excludes secrets and mutable runtime data', () => {
  const root = tempDir();
  fs.mkdirSync(path.join(root, 'core'), { recursive: true });
  fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  fs.mkdirSync(path.join(root, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'clusters', 'cv', 'python', 'output'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.js'), 'console.log("ok")\n');
  fs.writeFileSync(path.join(root, 'core', 'server.js'), 'module.exports = {}\n');
  fs.writeFileSync(path.join(root, 'config', 'secret.json'), '{"password":"never"}\n');
  fs.writeFileSync(path.join(root, 'logs', 'stdout.log'), 'mutable\n');
  fs.writeFileSync(path.join(root, 'clusters', 'cv', 'python', 'output', 'frame.jpg'), 'mutable\n');

  const manifest = buildManifest(root);
  fs.writeFileSync(path.join(root, 'release.json'), JSON.stringify(manifest));
  const repeated = buildManifest(root);
  assert.deepEqual(manifest.files.map(file => file.path), ['core/server.js', 'index.js']);
  assert.equal(repeated.contentDigest, manifest.contentDigest, 'release.json must not make the manifest self-referential');
  assert.equal(repeated.files.some(file => file.path === 'release.json'), false);
  assert.match(manifest.releaseId, /^amano-resilience-[a-f0-9]{12}$/);
  assert.equal(manifest.contentDigest.length, 64);
});
