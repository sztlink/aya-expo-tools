'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getDirSize, getFolderSizes } = require('../core/async-folder-size');

test('async folder sizing yields to the event loop and returns exact totals', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aya-folder-size-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'nested'));
  fs.writeFileSync(path.join(root, 'a.bin'), Buffer.alloc(1024));
  fs.writeFileSync(path.join(root, 'nested', 'b.bin'), Buffer.alloc(2048));

  let resolved = false;
  const scan = getDirSize(root).then(result => { resolved = true; return result; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(resolved, false, 'filesystem traversal must not complete synchronously on the control-plane tick');

  const result = await scan;
  assert.deepEqual(result, { bytes: 3072, mb: 0, files: 2 });
  assert.deepEqual(await getFolderSizes({ sample: root }), { sample: result });
});

test('missing folders return an empty measurement', async () => {
  const result = await getDirSize(path.join(os.tmpdir(), 'aya-folder-size-missing-' + Date.now()));
  assert.deepEqual(result, { bytes: 0, mb: 0, files: 0 });
});
