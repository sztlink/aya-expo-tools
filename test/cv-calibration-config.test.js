'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { parseLine, validateCvCalibration } = require('../clusters/cv/calibration-config');
const registerConfigRoutes = require('../core/routes/config');

const base = () => ({
  cameras: [{ id: 'cam-1' }, { id: 'cam-2' }],
  cv: {
    counter: {
      enabled: true,
      mode: 'dual',
      model: 'yolo11l',
      entry: { camera: 'cam-2', line: '100,200,800,200' },
      exit: { camera: 'cam-2', line: '100,600,800,600' },
    },
  },
});

test('accepts two bounded non-zero access lines', () => {
  assert.deepEqual(parseLine('0,0,1920,1080'), [0, 0, 1920, 1080]);
  assert.equal(validateCvCalibration(base()).ok, true);
});

test('rejects placeholders, out-of-frame, tiny and unknown-camera lines', () => {
  for (const line of ['TODO', '0,,100,100', '0.5,0,100,100', '0x10,0,100,100', '1e2,0,100,100', '0,0,5000,10', '10,10,11,11']) {
    const config = base();
    config.cv.counter.entry.line = line;
    assert.equal(validateCvCalibration(config).ok, false, line);
  }
  const config = base();
  config.cv.counter.exit.camera = 'cam-missing';
  assert.equal(validateCvCalibration(config).ok, false);
});

test('allows incomplete calibration while counter remains disabled', () => {
  const config = base();
  config.cv.counter.enabled = false;
  config.cv.counter.entry.line = 'TODO';
  assert.equal(validateCvCalibration(config).ok, true);
});

function configRouteFixture(state) {
  const puts = new Map();
  const app = { get() {}, post() {}, put(path, handler) { puts.set(path, handler); } };
  const config = base();
  config.cv.counter.enabled = false;
  registerConfigRoutes(app, {
    config,
    configName: 'test',
    scheduler: { getStatus: () => ({ state, desiredState: state, transition: null, pendingTransitions: [] }), updateConfig() {} },
    cvManager: { reload() {} },
  });
  return { config, handler: puts.get('/api/config') };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('blocks CV config changes while exhibition is open', (t) => {
  t.mock.method(fs, 'writeFileSync', () => assert.fail('must not write'));
  const fixture = configRouteFixture('open');
  const updated = structuredClone(fixture.config);
  updated.cv.counter.model = 'yolov8l';
  const res = response();
  fixture.handler({ body: updated }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'CV_MAINTENANCE_WINDOW_REQUIRED');
});

test('accepts valid CV config changes while exhibition is closed', (t) => {
  let writes = 0;
  t.mock.method(fs, 'writeFileSync', () => { writes++; });
  const fixture = configRouteFixture('closed');
  const updated = structuredClone(fixture.config);
  updated.cv.counter.model = 'yolov8l';
  const res = response();
  fixture.handler({ body: updated }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(writes, 1);
});
