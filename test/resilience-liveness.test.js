'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const core = require('../core/server');
const runtimeLog = require('../core/runtime-log');

function heartbeat(scheduler, managers = {}) {
  return {
    t: new Date().toISOString(),
    pid: process.pid,
    managers: {
      scheduler,
      cv: { enabled: true, running: false, ready: false },
      timelapse: { running: false },
      portalSync: { enabled: true, running: true },
      ...managers,
    },
  };
}

test('runtime liveness distinguishes process alive from operational readiness', async (t) => {
  fs.mkdirSync(runtimeLog.LOG_DIR, { recursive: true });
  const heartbeatPath = path.join(runtimeLog.LOG_DIR, 'heartbeat.json');
  const previous = fs.existsSync(heartbeatPath) ? fs.readFileSync(heartbeatPath) : null;
  t.after(() => {
    if (previous) fs.writeFileSync(heartbeatPath, previous);
    else { try { fs.unlinkSync(heartbeatPath); } catch {} }
  });

  fs.writeFileSync(heartbeatPath, JSON.stringify(heartbeat({ state: 'closed', desiredState: 'closed', transition: null })));
  const { server } = core.createApp({});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;

  let response = await fetch(`http://127.0.0.1:${port}/api/runtime/live`);
  let body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'alive');
  assert.equal(body.ready, true);

  fs.writeFileSync(heartbeatPath, JSON.stringify(heartbeat({ state: 'degraded', desiredState: 'open', transition: null })));
  response = await fetch(`http://127.0.0.1:${port}/api/runtime/live`);
  body = await response.json();
  assert.equal(body.status, 'alive');
  assert.equal(body.ready, false);
  assert.ok(body.readinessErrors.some(error => error.startsWith('scheduler-state:')));
  assert.ok(body.readinessErrors.includes('cv-not-running'));

  // Hardware failure may leave the scheduler degraded, but restarting Node does
  // not fix a projector. If the requested lifecycle was applied and CV is ready,
  // surface a warning without triggering the watchdog.
  fs.writeFileSync(heartbeatPath, JSON.stringify(heartbeat(
    { state: 'degraded', desiredState: 'open', isOpen: true, transition: null },
    { cv: { enabled: true, running: true, ready: true }, timelapse: { running: true } },
  )));
  response = await fetch(`http://127.0.0.1:${port}/api/runtime/live`);
  body = await response.json();
  assert.equal(body.ready, true);
  assert.ok(body.operationalWarnings.includes('scheduler-degraded'));
});
