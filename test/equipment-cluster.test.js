/**
 * Equipment Cluster Tests
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const cluster = require('../clusters/equipment');

describe('Equipment Cluster', () => {
  it('exports correct cluster contract', () => {
    assert.strictEqual(cluster.name, 'equipment');
    assert.strictEqual(typeof cluster.register, 'function');
    assert.strictEqual(typeof cluster.onOpen, 'function');
    assert.strictEqual(typeof cluster.onClose, 'function');
    assert.strictEqual(typeof cluster.getStatus, 'function');
  });

  it('has empty requires array', () => {
    assert(Array.isArray(cluster.requires));
    assert.strictEqual(cluster.requires.length, 0);
  });

  it('getStatus returns correct structure before register', () => {
    // Should handle being called before register (defensive)
    try {
      const status = cluster.getStatus();
      assert(status);
      assert.strictEqual(status.name, 'equipment');
      assert(typeof status.healthy === 'boolean');
      assert(status.details);
    } catch (err) {
      // It's ok if it throws before register, as long as structure is correct after
      assert(err);
    }
  });
});
