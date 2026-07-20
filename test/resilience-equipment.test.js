'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const equipment = require('../clusters/equipment');
const { Projector, ProjectorManager } = require('../clusters/equipment/pjlink');

test('PJLink rejects when the projector closes before returning a command response', async (t) => {
  const server = net.createServer(socket => {
    socket.write('PJLINK 0\r');
    socket.once('data', () => socket.end());
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const projector = new Projector({ id: 'test', ip: '127.0.0.1', port: server.address().port, retryAttempts: 1 });
  await assert.rejects(
    Promise.race([
      projector.powerOn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('test timeout')), 1000)),
    ]),
    /Connection closed before PJLink response/,
  );
});

test('PJLink serializes concurrent commands per projector', async (t) => {
  let active = 0;
  let maxActive = 0;
  const server = net.createServer(socket => {
    active++;
    maxActive = Math.max(maxActive, active);
    socket.write('PJLINK 0\r');
    socket.once('data', () => setTimeout(() => {
      socket.end('%1POWR=0\r');
      active--;
    }, 40));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const projector = new Projector({
    id: 'test', ip: '127.0.0.1', port: server.address().port,
    retryAttempts: 1,
  });
  const values = await Promise.all([projector.getPower(), projector.getPower()]);
  assert.deepEqual(values, ['off', 'off']);
  assert.equal(maxActive, 1);
});

test('PJLink retries a transient connection failure', async (t) => {
  let connections = 0;
  const server = net.createServer(socket => {
    connections++;
    socket.write('PJLINK 0\r');
    socket.once('data', () => {
      if (connections === 1) socket.end();
      else socket.end('%1POWR=0\r');
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const projector = new Projector({
    id: 'test', ip: '127.0.0.1', port: server.address().port,
    retryAttempts: 2, retryDelayMs: 1,
  });
  assert.equal(await projector.getPower(), 'off');
  assert.equal(connections, 2);
});

test('PJLink serializes opposite power intents so the last request wins', async () => {
  const projector = new Projector({ id: 'test', ip: '127.0.0.1', retryAttempts: 1 });
  let power = 'off';
  projector.getPower = async () => power;
  projector._powerOnCommand = async () => { await new Promise(resolve => setTimeout(resolve, 10)); power = 'on'; return { ok: true }; };
  projector._powerOffCommand = async () => { power = 'off'; return { ok: true }; };

  await Promise.all([projector.ensurePowerOn(), projector.ensurePowerOff()]);
  assert.equal(power, 'off');

  power = 'off';
  await Promise.all([projector.ensurePowerOn(), projector.powerOff()]);
  assert.equal(power, 'off', 'direct endpoint command must share the operation queue');
});

test('PJLink manager coalesces overlapping polls and reuses projector queues on reload', async () => {
  const config = {
    pjlink: { retryAttempts: 2, retryDelayMs: 0 },
    projectors: [{ id: 'proj-1', ip: '127.0.0.1' }],
  };
  const manager = new ProjectorManager(config);
  const projector = manager.get('proj-1');
  let resolvePoll;
  let calls = 0;
  projector.poll = () => {
    calls++;
    return new Promise(resolve => { resolvePoll = resolve; });
  };

  const first = manager.pollAll();
  const second = manager.pollAll();
  assert.strictEqual(first, second);
  assert.equal(calls, 1);
  resolvePoll(projector.getStatus());
  await first;

  manager.reload({ ...config, pjlink: { retryAttempts: 3, retryDelayMs: 0 } });
  assert.strictEqual(manager.get('proj-1'), projector);
  assert.equal(projector.retryAttempts, 3);
  assert.equal(projector.retryDelayMs, 0);
});

test('PJLink power reconciliation is idempotent for already reached states', async () => {
  const projector = new Projector({ id: 'test', ip: '127.0.0.1' });
  let commands = 0;
  projector.getPower = async () => 'on';
  projector.powerOn = async () => { commands += 1; return { ok: true }; };
  assert.deepEqual(await projector.ensurePowerOn(), { ok: true, noOp: true, power: 'on' });

  projector.getPower = async () => 'cooling';
  projector.powerOff = async () => { commands += 1; return { ok: true }; };
  assert.deepEqual(await projector.ensurePowerOff(), { ok: true, noOp: true, power: 'cooling' });
  assert.equal(commands, 0);
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
