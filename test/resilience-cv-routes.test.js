'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const registerCvRoutes = require('../clusters/cv/routes');

function fixture(scheduleOverrides = {}, restartResult = { ok: true }) {
  const posts = new Map();
  const app = {
    get() {},
    post(path, handler) { posts.set(path, handler); },
  };
  let restarts = 0;
  let ready = true;
  const scheduleStatus = {
    state: 'open',
    desiredState: 'open',
    transition: null,
    pendingTransitions: [],
    ...scheduleOverrides,
  };
  const cluster = {
    cvManager: {
      getStatus: () => ({ ready }),
      getCounterData: () => null,
      restart: async shouldStart => {
        restarts++;
        if (!shouldStart()) return { ok: false, cancelled: true, error: 'cancelled' };
        return restartResult;
      },
    },
    scheduler: { getStatus: () => scheduleStatus },
    data: {},
    cvRestartTimeoutMs: 10,
  };
  registerCvRoutes(app, cluster);
  return {
    handler: posts.get('/api/cv/restart'),
    scheduleStatus,
    setReady(value) { ready = value; },
    get restarts() { return restarts; },
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('CV restart route returns only after CV is ready', async () => {
  const f = fixture();
  const res = response();
  await f.handler({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(f.restarts, 1);
});

test('CV restart route rejects closed or transitioning schedules', async () => {
  for (const schedule of [
    { state: 'closed', desiredState: 'closed' },
    { state: 'opening', desiredState: 'open', transition: { action: 'open' } },
    { state: 'open', desiredState: 'open', pendingTransitions: [{ action: 'close' }] },
  ]) {
    const f = fixture(schedule);
    const res = response();
    await f.handler({}, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'SCHEDULE_NOT_STABLY_OPEN');
    assert.equal(f.restarts, 0);
  }
});

test('CV restart route reports readiness timeout', async () => {
  const f = fixture();
  f.setReady(false);
  const res = response();
  await f.handler({}, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.code, 'CV_RESTART_FAILED');
  assert.match(res.body.error, /readiness timeout/i);
});
