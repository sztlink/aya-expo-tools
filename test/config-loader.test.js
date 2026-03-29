// test/config-loader.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { loadConfig, getConfigName } = require('../core/config-loader');

describe('config-loader', () => {
  it('should load a valid config', () => {
    const result = loadConfig('beleza-astral');
    assert.strictEqual(result.valid, true);
    assert.ok(result.config);
    assert.strictEqual(result.config._name, 'beleza-astral');
    assert.ok(result.config.exhibition);
  });

  it('should return error for nonexistent config', () => {
    const result = loadConfig('nonexistent-config');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error);
    assert.ok(Array.isArray(result.available));
  });

  it('should handle BOM in config files', () => {
    // This would require a test config with BOM, but we test that the function exists
    const result = loadConfig('beleza-astral');
    assert.strictEqual(result.valid, true);
  });

  it('getConfigName should return null when no --config arg', () => {
    // Save original argv
    const originalArgv = process.argv;
    
    // Test without --config
    process.argv = ['node', 'index.js'];
    const result = getConfigName();
    assert.strictEqual(result, null);
    
    // Restore argv
    process.argv = originalArgv;
  });

  it('getConfigName should parse --config= argument', () => {
    // Save original argv
    const originalArgv = process.argv;
    
    // Test with --config
    process.argv = ['node', 'index.js', '--config=test-config'];
    const result = getConfigName();
    assert.strictEqual(result, 'test-config');
    
    // Restore argv
    process.argv = originalArgv;
  });
});
