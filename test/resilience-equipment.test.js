'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const equipment = require('../clusters/equipment');
const { Projector } = require('../clusters/equipment/pjlink');

test('PJLink rejects when the projector closes before returning a command response', async (t) => {
  const server = net.createServer(socket => {
    socket.write('PJLINK 0\r');
    socket.once('data', () => socket.end());
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const projector = new Projector({ id: 'test', ip: '127.0.0.1', port: server.address().port });
  await assert.rejects(
    Promise.race([
      projector.powerOn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('test timeout')), 1000)),
    ]),
    /Connection closed before PJLink response/,
  );
});

test('equipment lifecycle surfaces settled physical failures as degraded', async (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  t.mock.method(global, 'setTimeout', () => ({ unref() {} }));

  equipment.config = {
    projectors: [{ id: 'proj-1' }],
    smartplugs: [{ id: 'plug-1' }],
    tvs: [{ id: 'tv-1' }],
    audio: { volume: 70 },
  };
  equipment.projectors = {
    async powerOnAll() { return [{ status: 'fulfilled', value: { ok: false, error: 'PJLink ERR4' } }]; },
    async powerOffAll() { return [{ status: 'fulfilled', value: { ok: false, error: 'PJLink ERR4' } }]; },
    async pollAll() { return []; },
  };
  equipment.tuya = {
    isConfigured() { return true; },
    async allOn() { return [{ id: 'plug-1', ok: false, error: 'Tuya offline' }]; },
    async allOff() { return [{ id: 'plug-1', ok: false, error: 'Tuya offline' }]; },
  };
  equipment.tv = {
    async powerOn() { throw new Error('TV offline'); },
    async castStop() { throw new Error('TV offline'); },
    stopLoop() {},
  };
  equipment.audio = { setVolume() { throw new Error('audio unavailable'); } };
  equipment.broadcast = () => {};

  const opened = await equipment.onOpen();
  assert.equal(opened.ok, false);
  assert.ok(opened.errors.some(error => error.component === 'proj-1'));
  assert.ok(opened.errors.some(error => error.component === 'plug-1'));
  assert.ok(opened.errors.some(error => error.component === 'tv-1'));
  assert.ok(opened.errors.some(error => error.component === 'audio'));

  const closed = await equipment.onClose();
  assert.equal(closed.ok, false);
  assert.ok(closed.errors.some(error => error.component === 'proj-1'));
});
