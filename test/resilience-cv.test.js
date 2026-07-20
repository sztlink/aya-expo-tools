'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { CVManager } = require('../clusters/cv/cv-manager');

function quiet(t) {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
}

function fakeTimers() {
  const records = [];
  return {
    records,
    setTimeout(fn, delay) {
      const timer = {
        fn,
        delay,
        cancelled: false,
        unref() {},
      };
      records.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      timer.cancelled = true;
    },
  };
}

class FakeChild extends EventEmitter {
  constructor(pid) {
    super();
    this.pid = pid;
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.signals = [];
    this.autoExit = true;
  }

  kill(signal) {
    this.signals.push(signal);
    if (signal === 'SIGTERM' && this.autoExit && this.exitCode == null) {
      this.exitCode = 0;
      this.emit('exit', 0);
    }
    return true;
  }
}

function cvConfig(overrides = {}) {
  return {
    cameras: [
      { id: 'cam-1', ip: '127.0.0.1', user: 'test', password: 'test' },
      { id: 'cam-2', ip: '127.0.0.2', user: 'test', password: 'test' },
    ],
    cv: {
      enabled: true,
      cameras: ['cam-1', 'cam-2'],
      model: 'test-model',
      reid: { enabled: true },
      counter: {
        enabled: true,
        mode: 'dual',
        entry: { camera: 'cam-1' },
        exit: { camera: 'cam-2' },
      },
      ...overrides,
    },
  };
}

function makeManager(config, timers, extraOpts = {}) {
  const children = [];
  const spawnCalls = [];
  const manager = new CVManager(config, {
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    treeKill() {}, // never execute taskkill in unit tests
    spawn(command, args) {
      const child = new FakeChild(1000 + children.length);
      children.push(child);
      spawnCalls.push({ command, args, child });
      return child;
    },
    ...extraOpts,
  });
  let pythonFinds = 0;
  manager._findPython = () => { pythonFinds++; return 'fake-python'; };
  manager._getConfigPath = () => path.join('config', 'test.json');
  return { manager, children, spawnCalls, get pythonFinds() { return pythonFinds; } };
}

describe('Epic 1 CV cardinality', () => {
  it('supports a larger detector model without changing the counter model', (t) => {
    quiet(t);
    t.mock.method(fs, 'existsSync', () => true);
    const timers = fakeTimers();
    const fixture = makeManager(cvConfig({
      detectorModel: 'detector-large',
      model: 'legacy-small',
      counter: {
        enabled: true,
        mode: 'dual',
        model: 'counter-large',
        entry: { camera: 'cam-1' },
        exit: { camera: 'cam-2' },
      },
    }), timers);

    fixture.manager.start();
    const modelFor = call => call.args[call.args.indexOf('--model') + 1];
    const detectorCalls = fixture.spawnCalls.filter(call => path.basename(call.args[0]) === 'detector.py');
    const counterCalls = fixture.spawnCalls.filter(call => path.basename(call.args[0]) === 'counter.py');

    assert.equal(detectorCalls.length, 2);
    assert.equal(counterCalls.length, 2);
    assert.ok(detectorCalls.every(call => modelFor(call) === 'detector-large'));
    assert.ok(counterCalls.every(call => modelFor(call) === 'counter-large'));
  });

  it('coalesces concurrent maintenance restarts', async (t) => {
    quiet(t);
    t.mock.method(fs, 'existsSync', () => true);
    const timers = fakeTimers();
    const fixture = makeManager(cvConfig({
      cameras: ['cam-1'], reid: { enabled: false }, counter: { enabled: false },
    }), timers);
    fixture.manager.start();

    const first = fixture.manager.restart(() => true);
    const second = fixture.manager.restart(() => true);
    assert.strictEqual(first, second);
    const result = await first;

    assert.equal(result.ok, true);
    assert.equal(fixture.spawnCalls.length, 2);
    assert.equal(fixture.manager.processes.size, 1);
  });

  it('lets scheduler stop cancel an in-flight maintenance restart', async (t) => {
    quiet(t);
    t.mock.method(fs, 'existsSync', () => true);
    const timers = fakeTimers();
    const fixture = makeManager(cvConfig({
      cameras: ['cam-1'], reid: { enabled: false }, counter: { enabled: false },
    }), timers);
    fixture.manager.start();
    fixture.children[0].autoExit = false;

    const restarting = fixture.manager.restart(() => true);
    const schedulerStop = fixture.manager.stop();
    const forceStop = timers.records.find(timer => timer.delay === 5000 && !timer.cancelled);
    assert.ok(forceStop);
    forceStop.fn();

    await schedulerStop;
    const result = await restarting;
    assert.equal(result.ok, false);
    assert.equal(result.cancelled, true);
    assert.equal(fixture.spawnCalls.length, 1, 'cancelled restart must not resurrect CV');
    assert.equal(fixture.manager.processes.size, 0);
  });

  it('does not expose stale counter files while the counter is disabled', (t) => {
    quiet(t);
    const timers = fakeTimers();
    const fixture = makeManager(cvConfig({ reid: { enabled: false }, counter: { enabled: false } }), timers);
    fixture.manager._readCounterData = () => ({ entries: 99, exits: 10, occupancy: 89 });

    const status = fixture.manager.getStatus();
    assert.deepEqual(status.counter, { running: false, enabled: false });
    assert.equal(status.cardinality.counters.expected, 0);
  });

  it('keeps one detector/ReID/counter per unit and fills only missing units', async (t) => {
    quiet(t);
    t.mock.method(fs, 'existsSync', () => true); // prevents output/config filesystem writes
    const timers = fakeTimers();
    const fixture = makeManager(cvConfig(), timers);
    const { manager, spawnCalls } = fixture;

    const first = manager.start();
    assert.equal(first.ok, true);
    assert.equal(manager.processes.size, 2);
    assert.equal(manager.reidProcesses.size, 2);
    assert.equal(manager.counterProcesses.size, 2);
    assert.equal(spawnCalls.length, 6);
    assert.equal(fixture.pythonFinds, 1);
    assert.equal(manager.getStatus().ready, false, 'spawn alone is not readiness');
    for (const call of spawnCalls) {
      const script = path.basename(call.args[0]);
      if (script === 'detector.py') {
        call.child.stdout.emit('data', Buffer.from(`${JSON.stringify({ event: 'ready', model: 'test', format: 'pt', gpuName: 'fake', zones: [] })}\n`));
      } else if (script === 'reid.py') {
        call.child.stdout.emit('data', Buffer.from(`${JSON.stringify({ event: 'ready', backend: 'fake', sameZoneCameras: [] })}\n`));
      }
    }
    assert.equal(manager.getStatus().ready, false, 'counter process presence is not counter readiness');
    manager._readJsonFile = file => file.endsWith('status.json')
      ? { status: 'running', timestamp: new Date().toISOString() }
      : null;
    assert.equal(manager.getStatus().ready, true, 'all expected units must report ready/cardinality');

    const repeated = manager.start();
    assert.equal(repeated.noOp, true);
    assert.equal(spawnCalls.length, 6);
    assert.equal(fixture.pythonFinds, 1, 'full repeated start skips Python discovery');

    // A clean child exit leaves exactly one missing unit. start() must replace
    // that detector without duplicating ReID or either counter.
    const oldCam2 = manager.processes.get('cam-2').process;
    oldCam2.emit('exit', 0);
    assert.equal(manager.processes.size, 1);

    const partial = manager.start();
    assert.equal(partial.ok, true);
    assert.equal(spawnCalls.length, 7);
    assert.equal(manager.processes.size, 2);
    assert.equal(manager.reidProcesses.size, 2);
    assert.equal(manager.counterProcesses.size, 2);

    const scripts = spawnCalls.map(call => path.basename(call.args[0]));
    assert.equal(scripts.filter(name => name === 'detector.py').length, 3);
    assert.equal(scripts.filter(name => name === 'reid.py').length, 2);
    assert.equal(scripts.filter(name => name === 'counter.py').length, 2);

    await manager.stop();
  });

  it('restarts cleanly exited owned detector, ReID and counter units once', async (t) => {
    quiet(t);
    t.mock.method(fs, 'existsSync', () => true);
    const timers = fakeTimers();
    const fixture = makeManager(cvConfig(), timers);
    const { manager, spawnCalls } = fixture;

    manager.start();
    manager.processes.get('cam-1').process.emit('exit', 0);
    manager.reidProcesses.get('cam-1').process.emit('exit', 0);
    manager.counterProcesses.get('entry').process.emit('exit', 0);

    assert.equal(manager._restartTimers.size, 3);
    const restarts = timers.records.filter(timer => timer.delay === 10000 && !timer.cancelled);
    assert.equal(restarts.length, 3);
    for (const timer of restarts) timer.fn();

    assert.equal(manager.processes.size, 2);
    assert.equal(manager.reidProcesses.size, 2);
    assert.equal(manager.counterProcesses.size, 2);
    assert.equal(spawnCalls.length, 9);
    assert.equal(manager._restartTimers.size, 0);

    await manager.stop();
  });

  it('a stale old-generation exit cannot delete the replacement process', async (t) => {
    quiet(t);
    t.mock.method(fs, 'existsSync', () => true);
    const timers = fakeTimers();
    const fixture = makeManager(cvConfig({
      cameras: ['cam-1'],
      reid: { enabled: false },
      counter: { enabled: false },
    }), timers);
    const { manager, spawnCalls } = fixture;

    manager.start();
    const oldChild = manager.processes.get('cam-1').process;
    const oldGeneration = manager._generation;
    oldChild.autoExit = false;

    const stopping = manager.stop();
    const restarting = manager.start();
    assert.equal(spawnCalls.length, 1, 'replacement waits for old generation termination');
    const forceStop = timers.records.find(timer => timer.delay === 5000 && !timer.cancelled);
    assert.ok(forceStop);
    forceStop.fn();
    await stopping;
    await restarting;
    const replacement = manager.processes.get('cam-1');
    assert.notStrictEqual(replacement.process, oldChild);
    assert.ok(replacement.generation > oldGeneration);
    assert.equal(spawnCalls.length, 2);

    oldChild.emit('exit', 1);
    assert.strictEqual(manager.processes.get('cam-1'), replacement);
    assert.equal(manager._restartTimers.size, 0);
    assert.equal(spawnCalls.length, 2);

    await manager.stop();
  });

  it('stop cancels restart timers and stale callbacks cannot resurrect children', async (t) => {
    quiet(t);
    t.mock.method(fs, 'existsSync', () => true);
    const timers = fakeTimers();
    const fixture = makeManager(cvConfig({
      cameras: ['cam-1'],
      reid: { enabled: false },
      counter: { enabled: false },
    }), timers);
    const { manager, spawnCalls } = fixture;

    manager.start();
    const crashed = manager.processes.get('cam-1').process;
    crashed.emit('exit', 1);
    assert.equal(manager.processes.size, 0);
    assert.equal(manager._restartTimers.size, 1);

    const staleRestart = timers.records.find(timer => timer.delay === 10000);
    assert.ok(staleRestart);

    await manager.stop();
    assert.equal(staleRestart.cancelled, true);
    assert.equal(manager._restartTimers.size, 0);

    await manager.start();
    const replacement = manager.processes.get('cam-1');
    assert.equal(spawnCalls.length, 2);

    // Simulate an already-queued callback firing despite clearTimeout().
    staleRestart.fn();
    assert.equal(spawnCalls.length, 2);
    assert.strictEqual(manager.processes.get('cam-1'), replacement);

    await manager.stop();
  });

  it('Windows stop captures process trees before terminating launchers', async (t) => {
    quiet(t);
    t.mock.method(fs, 'existsSync', () => true);
    const timers = fakeTimers();
    const killedTrees = [];
    const fixture = makeManager(cvConfig({
      cameras: ['cam-1'],
      reid: { enabled: false },
      counter: { enabled: false },
    }), timers, {
      platform: 'win32',
      treeKill(pid) { killedTrees.push(pid); },
    });

    fixture.manager.start();
    const child = fixture.manager.processes.get('cam-1').process;
    child.autoExit = false;
    await fixture.manager.stop();

    assert.deepEqual(killedTrees, [child.pid]);
    assert.deepEqual(child.signals, [], 'launcher must remain alive until taskkill /T captures descendants');
  });

  it('child error releases ownership and schedules one guarded restart', async (t) => {
    quiet(t);
    t.mock.method(fs, 'existsSync', () => true);
    const timers = fakeTimers();
    const fixture = makeManager(cvConfig({
      cameras: ['cam-1'],
      reid: { enabled: false },
      counter: { enabled: false },
    }), timers);
    const { manager, spawnCalls } = fixture;

    manager.start();
    const failed = manager.processes.get('cam-1').process;
    failed.emit('error', new Error('spawn failed'));

    assert.equal(manager.processes.size, 0);
    assert.equal(manager._restartTimers.size, 1);
    const restart = timers.records.find(timer => timer.delay === 10000);
    assert.ok(restart);

    restart.fn();
    assert.equal(spawnCalls.length, 2);
    assert.equal(manager.processes.size, 1);
    assert.equal(manager._restartTimers.size, 0);

    await manager.stop();
  });
});
