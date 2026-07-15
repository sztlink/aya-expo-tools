'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { startManagers } = require('../core/server');
const { Scheduler } = require('../core/scheduler');
const { PortalSync } = require('../clusters/communication/portal-sync');

function quiet(t) {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
}

function fakeCron() {
  return {
    jobs: [],
    schedule(expression, callback, options) {
      const job = { expression, callback, options, stop() {} };
      this.jobs.push(job);
      return job;
    },
  };
}

function config() {
  return {
    pjlink: { pollInterval: 1234 },
    schedule: {
      timezone: 'America/Sao_Paulo',
      days: {
        mon: null,
        tue: { open: '08:00', close: '21:30' },
      },
    },
  };
}

describe('Epic 1 boot lifecycle', () => {
  it('starts always-on managers in order and scheduler last, without direct scheduled starts', async (t) => {
    quiet(t);
    const trace = [];
    const forbidden = [];
    const managers = {
      projectors: { startPolling(interval) { trace.push(`projectors:${interval}`); } },
      cameras: { startPolling(interval) { trace.push(`cameras:${interval}`); } },
      data: { start() { trace.push('data'); return { ok: true }; } },
      serverHealth: { start() { trace.push('health'); } },
      portalSync: { start() { trace.push('portal'); return { ok: true }; } },
      runtimeMonitor: { start(received) { assert.strictEqual(received, managers); trace.push('runtime'); } },
      scheduler: {
        start() {
          trace.push('scheduler');
          assert.deepEqual(trace, [
            'projectors:1234', 'cameras:30000', 'data', 'health', 'portal', 'runtime', 'scheduler',
          ]);
          return { ok: true };
        },
      },
      cvManager: { start() { forbidden.push('cv'); } },
      cvLogger: { start() { forbidden.push('logger'); } },
      timelapse: { start() { forbidden.push('timelapse'); } },
    };

    const result = await startManagers(config(), managers);
    assert.equal(result.ok, true);
    assert.deepEqual(forbidden, []);
    assert.deepEqual(trace, [
      'projectors:1234', 'cameras:30000', 'data', 'health', 'portal', 'runtime', 'scheduler',
    ]);
  });

  it('closed boot reconciles to closed without starting CV, logger or timelapse', async (t) => {
    quiet(t);
    const trace = [];
    const clusters = {
      equipment: {
        async onOpen() { trace.push('equipment:start'); return { ok: true }; },
        async onClose() { trace.push('equipment:stop'); return { ok: true }; },
      },
      cameras: {
        async onOpen() { trace.push('timelapse:start'); return { ok: true }; },
        async onClose() { trace.push('timelapse:stop'); return { ok: true }; },
      },
      cv: {
        async onOpen() { trace.push('cv:start'); return { ok: true }; },
        async onClose() { trace.push('cv:stop'); return { ok: true }; },
      },
      data: {
        start() { trace.push('reports:start'); return { ok: true }; },
        async onOpen() { trace.push('logger:start'); return { ok: true }; },
        async onClose() { trace.push('logger:stop'); return { ok: true }; },
      },
      communication: {
        async onOpen() { return { ok: true, noOp: true }; },
        async onClose() { trace.push('portal:off-hours'); return { ok: true, noOp: true }; },
      },
    };
    const scheduler = new Scheduler(config(), clusters, {
      cron: fakeCron(),
      now: () => new Date('2026-07-13T11:00:00Z'), // Monday 08:00 in Sao Paulo
    });
    const managers = {
      projectors: { startPolling() { trace.push('poll:projectors'); } },
      cameras: { startPolling() { trace.push('poll:cameras'); } },
      data: clusters.data,
      serverHealth: { start() { trace.push('health:start'); } },
      portalSync: { start() { trace.push('portal:start'); return { ok: true }; } },
      runtimeMonitor: { start() { trace.push('runtime:start'); } },
      scheduler,
      // These references are telemetry/shutdown dependencies only.
      cvManager: { start() { trace.push('forbidden:cv-direct'); } },
      cvLogger: { start() { trace.push('forbidden:logger-direct'); } },
      timelapse: { start() { trace.push('forbidden:timelapse-direct'); } },
    };

    await startManagers(config(), managers);

    assert.equal(scheduler.getStatus().state, 'closed');
    assert.equal(trace.includes('cv:start'), false);
    assert.equal(trace.includes('logger:start'), false);
    assert.equal(trace.includes('timelapse:start'), false);
    assert.equal(trace.some(item => item.startsWith('forbidden:')), false);
    assert.equal(trace.includes('portal:start'), true);
    assert.equal(trace.includes('portal:off-hours'), true);
  });

  it('open boot starts scheduled resources once and only after all always-on managers', async (t) => {
    quiet(t);
    const trace = [];
    const clusters = {
      equipment: {
        async onOpen() { trace.push('equipment:open'); return { ok: true }; },
        async onClose() { trace.push('equipment:close'); return { ok: true }; },
      },
      cameras: {
        async onOpen() { trace.push('timelapse:start'); return { ok: true }; },
        async onClose() { trace.push('timelapse:stop'); return { ok: true }; },
      },
      cv: {
        async onOpen() { trace.push('cv:start'); return { ok: true }; },
        async onClose() { trace.push('cv:stop'); return { ok: true }; },
      },
      data: {
        start() { trace.push('reports:start'); return { ok: true }; },
        async onOpen() { trace.push('logger:start'); return { ok: true }; },
        async onClose() { trace.push('logger:stop'); return { ok: true }; },
      },
      communication: {
        async onOpen() { trace.push('portal:on-open-noop'); return { ok: true, noOp: true }; },
        async onClose() { return { ok: true, noOp: true }; },
      },
    };
    const scheduler = new Scheduler(config(), clusters, {
      cron: fakeCron(),
      now: () => new Date('2026-07-14T11:00:00Z'), // Tuesday 08:00 local
    });
    const managers = {
      projectors: { startPolling() { trace.push('poll:projectors'); } },
      cameras: { startPolling() { trace.push('poll:cameras'); } },
      data: clusters.data,
      serverHealth: { start() { trace.push('health:start'); } },
      portalSync: { start() { trace.push('portal:start'); return { ok: true }; } },
      runtimeMonitor: { start() { trace.push('runtime:start'); } },
      scheduler,
    };

    await startManagers(config(), managers);
    await scheduler.start(); // repeated start must not reconcile twice

    assert.equal(scheduler.getStatus().state, 'open');
    for (const event of ['equipment:open', 'timelapse:start', 'cv:start', 'logger:start']) {
      assert.equal(trace.filter(item => item === event).length, 1, `${event} must happen once`);
    }
    const firstScheduled = trace.indexOf('equipment:open');
    for (const event of ['poll:projectors', 'poll:cameras', 'reports:start', 'health:start', 'portal:start', 'runtime:start']) {
      assert.ok(trace.indexOf(event) >= 0 && trace.indexOf(event) < firstScheduled, `${event} precedes reconciliation`);
    }
  });
});

describe('Epic 1 cluster lifecycle adapters', () => {
  it('camera onOpen/onClose controls timelapse idempotently', async (t) => {
    quiet(t);
    const cluster = require('../clusters/cameras');
    const previous = { timelapse: cluster.timelapse, active: cluster._timelapseActive };
    let running = false;
    let starts = 0;
    let stops = 0;
    cluster.timelapse = {
      start() { starts++; running = true; },
      stop() { stops++; running = false; },
      getStats() { return { running }; },
    };
    cluster._timelapseActive = false;
    t.after(() => {
      cluster.timelapse = previous.timelapse;
      cluster._timelapseActive = previous.active;
    });

    assert.equal((await cluster.onOpen()).ok, true);
    assert.equal((await cluster.onOpen()).noOp, true);
    assert.equal((await cluster.onClose()).ok, true);
    assert.equal((await cluster.onClose()).noOp, true);
    assert.equal(starts, 1);
    assert.equal(stops, 1);
  });

  it('data keeps report cron always-on while CV logger follows open/close idempotently', async (t) => {
    quiet(t);
    const cron = require('node-cron');
    const jobs = [];
    t.mock.method(cron, 'schedule', (expression, callback, options) => {
      const job = { expression, callback, options, stops: 0, stop() { this.stops++; } };
      jobs.push(job);
      return job;
    });

    const data = require('../clusters/data');
    const cvManager = { getStatus() { return { running: true }; } };
    data.register({}, config(), { cv: { cvManager } });
    let loggerRunning = false;
    let loggerStarts = 0;
    let loggerStops = 0;
    data.cvLogger = {
      isRunning() { return loggerRunning; },
      start(received) {
        assert.strictEqual(received, cvManager);
        loggerStarts++;
        loggerRunning = true;
        return { ok: true };
      },
      stop() {
        loggerStops++;
        loggerRunning = false;
        return { ok: true };
      },
    };
    t.after(() => data.stop());

    assert.equal(data.start().ok, true);
    assert.equal(data.start().noOp, true);
    assert.equal(jobs.length, 2);
    assert.equal((await data.onOpen()).ok, true);
    assert.equal((await data.onOpen()).noOp, true);
    assert.equal((await data.onClose()).ok, true);
    assert.equal((await data.onClose()).noOp, true);
    assert.equal(loggerStarts, 1);
    assert.equal(loggerStops, 1);
    assert.equal(data.cronJobs.length, 2, 'schedule close does not stop report jobs');
  });

  it('Portal Sync start is idempotent and schedule close does not stop it', async (t) => {
    quiet(t);
    const portal = new PortalSync({
      exhibition: { slug: 'test' },
      portalSync: { url: 'http://portal.invalid', apiKey: 'test-key' },
    }, null, null, null, null, null, null, null);
    let pushes = 0;
    portal._push = async () => { pushes++; };

    assert.equal(portal.start().ok, true);
    assert.equal(portal.start().noOp, true);
    assert.equal(pushes, 1);

    const communication = require('../clusters/communication');
    const previous = communication.portalSync;
    communication.portalSync = portal;
    t.after(() => {
      portal.stop();
      communication.portalSync = previous;
    });

    const close = await communication.onClose();
    assert.equal(close.noOp, true);
    assert.equal(portal.getStatus().running, true);
  });
});
