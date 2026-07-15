'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Scheduler } = require('../core/scheduler');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function quiet(t) {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
}

function scheduleConfig() {
  return {
    schedule: {
      timezone: 'America/Sao_Paulo',
      days: {
        mon: null,
        tue: { open: '08:00', close: '21:30' },
        wed: { open: '08:00', close: '21:30' },
        thu: { open: '08:00', close: '21:30' },
        fri: { open: '08:00', close: '21:30' },
        sat: { open: '08:00', close: '21:30' },
        sun: { open: '08:00', close: '21:30' },
      },
    },
  };
}

describe('Epic 1 scheduler state machine', () => {
  it('shares the exact Promise for concurrent equal opens and then no-ops', async (t) => {
    quiet(t);
    const gate = deferred();
    let opens = 0;
    const scheduler = new Scheduler(scheduleConfig(), {
      equipment: {
        async onOpen() { opens++; await gate.promise; return { ok: true }; },
        async onClose() { return { ok: true }; },
      },
    }, { reconcile: false });

    const first = scheduler.executeOpen({ source: 'test' });
    const second = scheduler.executeOpen({ source: 'test' });

    assert.strictEqual(first, second);
    assert.equal(scheduler.getStatus(new Date('2026-07-14T11:00:00Z')).state, 'opening');
    assert.equal(opens, 1);

    gate.resolve();
    const result = await first;
    assert.equal(result.ok, true);
    assert.equal(result.state, 'open');
    assert.equal(opens, 1);

    const noOp = await scheduler.executeOpen();
    assert.equal(noOp.ok, true);
    assert.equal(noOp.noOp, true);
    assert.equal(opens, 1);
  });

  it('serializes opposite transitions without overlap', async (t) => {
    quiet(t);
    const gate = deferred();
    const events = [];
    let active = 0;
    let maxActive = 0;

    const scheduler = new Scheduler(scheduleConfig(), {
      equipment: {
        async onOpen() {
          events.push('open:start');
          active++;
          maxActive = Math.max(maxActive, active);
          await gate.promise;
          active--;
          events.push('open:end');
          return { ok: true };
        },
        async onClose() {
          events.push('close:start');
          active++;
          maxActive = Math.max(maxActive, active);
          active--;
          events.push('close:end');
          return { ok: true };
        },
      },
    }, { reconcile: false });

    const opening = scheduler.executeOpen();
    const closing = scheduler.executeClose();
    assert.notStrictEqual(opening, closing);
    assert.deepEqual(events, ['open:start']);

    gate.resolve();
    const openResult = await opening;
    assert.equal(openResult.ok, true);
    assert.equal(scheduler.getStatus().state, 'open', 'open Promise settles at a stable boundary');
    const closeResult = await closing;
    assert.equal(closeResult.ok, true);
    assert.equal(maxActive, 1);
    assert.deepEqual(events, ['open:start', 'open:end', 'close:start', 'close:end']);
    assert.equal(scheduler.getStatus().state, 'closed');
  });

  it('stop cancels queued work and waits for the active transition to quiesce', async (t) => {
    quiet(t);
    const gate = deferred();
    const events = [];
    const scheduler = new Scheduler(scheduleConfig(), {
      equipment: {
        async onOpen() { events.push('open'); await gate.promise; return { ok: true }; },
        async onClose() { events.push('close'); return { ok: true }; },
      },
    }, { reconcile: false });

    const opening = scheduler.executeOpen();
    const queuedClose = scheduler.executeClose();
    let stopped = false;
    const stopping = scheduler.stop().then(result => { stopped = true; return result; });

    const closeResult = await queuedClose;
    assert.equal(closeResult.cancelled, true);
    assert.equal(stopped, false);
    assert.deepEqual(events, ['open']);

    gate.resolve();
    assert.equal((await opening).ok, true);
    assert.equal((await stopping).ok, true);
    assert.equal(stopped, true);
    assert.deepEqual(events, ['open']);
  });

  it('treats resolved ok:false and thrown errors as degraded failures', async (t) => {
    quiet(t);
    let cvOpened = 0;
    const scheduler = new Scheduler(scheduleConfig(), {
      equipment: {
        async onOpen() { return { ok: false, error: 'projector timeout' }; },
      },
      cameras: {
        async onOpen() { throw new Error('camera unavailable'); },
      },
      cv: {
        async onOpen() { cvOpened++; return { ok: true }; },
      },
    }, { reconcile: false });

    const result = await scheduler.executeOpen();
    const status = scheduler.getStatus(new Date('2026-07-14T11:00:00Z'));

    assert.equal(result.ok, false);
    assert.equal(result.state, 'degraded');
    assert.equal(result.errors.length, 2);
    assert.deepEqual(result.errors.map(item => item.cluster), ['equipment', 'cameras']);
    assert.equal(cvOpened, 1, 'later clusters still run after a partial failure');
    assert.equal(status.actualState, 'degraded');
    assert.equal(status.desiredState, 'open');
    assert.equal(status.transition, null);
    assert.equal(status.lastTransition.status, 'degraded');
    assert.equal(status.errors.length, 2);
  });

  it('calculates desired state in the configured timezone with exact boundaries', (t) => {
    quiet(t);
    const scheduler = new Scheduler(scheduleConfig(), {}, { reconcile: false });

    assert.equal(scheduler.getDesiredState(new Date('2026-07-13T11:00:00Z')), 'closed', 'Monday is closed');
    assert.equal(scheduler.getDesiredState(new Date('2026-07-14T10:59:00Z')), 'closed', '07:59 local is closed');
    assert.equal(scheduler.getDesiredState(new Date('2026-07-14T11:00:00Z')), 'open', '08:00 local is inclusive');
    assert.equal(scheduler.getDesiredState(new Date('2026-07-15T00:29:00Z')), 'open', '21:29 local is open');
    assert.equal(scheduler.getDesiredState(new Date('2026-07-15T00:30:00Z')), 'closed', '21:30 local is exclusive');
  });

  it('schedules an overnight close on the following weekday', async (t) => {
    quiet(t);
    const cron = {
      jobs: [],
      schedule(expression, callback, options) {
        const job = { expression, callback, options, stop() {} };
        this.jobs.push(job);
        return job;
      },
    };
    const scheduler = new Scheduler({
      schedule: {
        timezone: 'America/Sao_Paulo',
        days: { fri: { open: '20:00', close: '02:00' } },
      },
    }, {}, { cron, reconcile: false });

    await scheduler.start({ reconcile: false });
    assert.deepEqual(cron.jobs.map(job => job.expression), ['0 20 * * 5', '0 2 * * 6']);
    assert.equal(scheduler.getDesiredState(new Date('2026-07-18T00:00:00Z')), 'open'); // Fri 21:00
    assert.equal(scheduler.getDesiredState(new Date('2026-07-18T04:59:00Z')), 'open'); // Sat 01:59
    assert.equal(scheduler.getDesiredState(new Date('2026-07-18T05:00:00Z')), 'closed'); // Sat 02:00
  });

  it('an explicit null day overrides an overnight carry-over', (t) => {
    quiet(t);
    const scheduler = new Scheduler({
      schedule: {
        timezone: 'America/Sao_Paulo',
        days: { fri: { open: '20:00', close: '02:00' }, sat: null },
      },
    }, {}, { reconcile: false });

    assert.equal(scheduler.getDesiredState(new Date('2026-07-18T04:00:00Z')), 'closed'); // Sat 01:00
  });

  it('manual override remains the effective desired state until the next scheduled transition', async (t) => {
    quiet(t);
    const scheduler = new Scheduler(scheduleConfig(), {}, { reconcile: false });
    await scheduler.executeOpen({ source: 'manual', actor: 'operator' });
    let status = scheduler.getStatus(new Date('2026-07-13T12:00:00Z')); // Monday closed by calendar
    assert.equal(status.scheduledDesiredState, 'closed');
    assert.equal(status.desiredState, 'open');
    assert.equal(status.manualOverride.actor, 'operator');

    await scheduler.executeClose({ source: 'schedule' });
    status = scheduler.getStatus(new Date('2026-07-14T12:00:00Z'));
    assert.equal(status.manualOverride, null);
    assert.equal(status.desiredState, 'open');
  });

  it('start is idempotent, schedules cron once and reconciles boot once', async (t) => {
    quiet(t);
    const jobs = [];
    const fakeCron = {
      schedule(expression, callback, options) {
        const job = { expression, callback, options, stops: 0, stop() { this.stops++; } };
        jobs.push(job);
        return job;
      },
    };
    let opens = 0;
    const scheduler = new Scheduler({
      schedule: {
        timezone: 'America/Sao_Paulo',
        days: { mon: null, tue: { open: '08:00', close: '21:30' } },
      },
    }, {
      equipment: {
        async onOpen() { opens++; return { ok: true }; },
        async onClose() { return { ok: true }; },
      },
    }, {
      cron: fakeCron,
      now: () => new Date('2026-07-14T11:00:00Z'),
    });

    const first = scheduler.start();
    const second = scheduler.start();
    assert.strictEqual(first, second);
    const result = await first;

    assert.equal(result.ok, true);
    assert.equal(opens, 1);
    assert.equal(jobs.length, 2);
    assert.equal(scheduler.getStatus().jobCount, 2);
    assert.equal(scheduler.getStatus().bootReconciled, true);

    await scheduler.start();
    assert.equal(opens, 1);
    assert.equal(jobs.length, 2);

    scheduler.stop();
    assert.deepEqual(jobs.map(job => job.stops), [1, 1]);
  });
});
