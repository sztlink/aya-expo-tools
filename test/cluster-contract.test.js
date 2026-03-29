/**
 * Cluster Contract Test — verifica que todos os clusters implementam o contrato.
 * Roda com: node --test test/cluster-contract.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const CLUSTER_DIR = path.join(__dirname, '..', 'clusters');
const VALID_CLUSTERS = ['equipment', 'cameras', 'cv', 'data', 'communication'];
const clusterNames = fs.readdirSync(CLUSTER_DIR).filter(d =>
  fs.statSync(path.join(CLUSTER_DIR, d)).isDirectory() && VALID_CLUSTERS.includes(d)
);

describe('Cluster Contract', () => {
  for (const name of clusterNames) {
    describe(name, () => {
      const clusterPath = path.join(CLUSTER_DIR, name, 'index.js');

      it('index.js existe', () => {
        assert.ok(fs.existsSync(clusterPath), `${clusterPath} nao existe`);
      });

      it('exporta name, requires, register, onOpen, onClose, getStatus', () => {
        const cluster = require(clusterPath);
        assert.strictEqual(typeof cluster.name, 'string', 'name deve ser string');
        assert.ok(Array.isArray(cluster.requires), 'requires deve ser array');
        assert.strictEqual(typeof cluster.register, 'function', 'register deve ser function');
        assert.strictEqual(typeof cluster.onOpen, 'function', 'onOpen deve ser function');
        assert.strictEqual(typeof cluster.onClose, 'function', 'onClose deve ser function');
        assert.strictEqual(typeof cluster.getStatus, 'function', 'getStatus deve ser function');
      });

      it('name corresponde ao diretorio', () => {
        const cluster = require(clusterPath);
        assert.strictEqual(cluster.name, name, `cluster.name (${cluster.name}) != dir (${name})`);
      });
    });
  }
});
