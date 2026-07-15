'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const registerScheduleRoutes = require('../core/routes/schedule');

function setup(scheduler) {
  const routes = new Map();
  const app = {
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
  };
  registerScheduleRoutes(app, { scheduler });
  return routes;
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('Epic 1 schedule routes', () => {
  it('preserves the success envelope and adds transition/status details', async () => {
    const result = { ok: true, action: 'open', state: 'open', noOp: false };
    const status = { state: 'open', desiredState: 'open' };
    const scheduler = {
      async executeOpen(context) {
        assert.equal(context.source, 'manual');
        return result;
      },
      getStatus() { return status; },
    };
    const routes = setup(scheduler);
    const res = response();

    await routes.get('POST /api/schedule/open')({ body: {}, headers: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.data.message, 'Exhibition opened');
    assert.strictEqual(res.body.data.result, result);
    assert.strictEqual(res.body.data.status, status);
  });

  it('returns HTTP 500 when a resolved transition is degraded', async () => {
    const result = {
      ok: false,
      action: 'close',
      state: 'degraded',
      errors: [{ cluster: 'equipment', message: 'power off failed' }],
    };
    const scheduler = {
      async executeClose() { return result; },
      getStatus() { return { state: 'degraded', errors: result.errors }; },
    };
    const routes = setup(scheduler);
    const res = response();

    await routes.get('POST /api/schedule/close')({ body: {}, headers: {} }, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.code, 'CLOSE_FAILED');
    assert.match(res.body.error, /power off failed/);
    assert.strictEqual(res.body.data.result, result);
  });
});
