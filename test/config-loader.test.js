// test/config-loader.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadConfig, getConfigName } = require('../core/config-loader');

describe('config-loader', () => {
  it('should load a valid config', () => {
    const result = loadConfig('template-amano-rio');
    assert.strictEqual(result.valid, true);
    assert.ok(result.config);
    assert.strictEqual(result.config._name, 'template-amano-rio');
    assert.ok(result.config.exhibition);
  });

  it('should return error for nonexistent config', () => {
    const result = loadConfig('nonexistent-config');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error);
    assert.ok(Array.isArray(result.available));
  });

  it('should handle BOM in config files', (t) => {
    const name = 'test-bom-resilience';
    const target = path.join(__dirname, '..', 'config', `${name}.json`);
    const source = fs.readFileSync(path.join(__dirname, '..', 'config', 'template-amano-rio.json'), 'utf8');
    fs.writeFileSync(target, `\uFEFF${source}`);
    t.after(() => { try { fs.unlinkSync(target); } catch {} });
    const result = loadConfig(name);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.config._name, name);
  });

  it('getConfigName should return null when no --config arg', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'index.js'];
    const result = getConfigName();
    assert.strictEqual(result, null);
    process.argv = originalArgv;
  });

  it('getConfigName should parse --config= argument', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'index.js', '--config=test-config'];
    const result = getConfigName();
    assert.strictEqual(result, 'test-config');
    process.argv = originalArgv;
  });
});
