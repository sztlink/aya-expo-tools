'use strict';

const FRAME_WIDTH = 1920;
const FRAME_HEIGHT = 1080;

function parseLine(line) {
  if (typeof line !== 'string') return null;
  const tokens = line.split(',').map(value => value.trim());
  if (tokens.length !== 4 || tokens.some(value => !/^\d+$/.test(value))) return null;
  const values = tokens.map(Number);
  const [x1, y1, x2, y2] = values;
  if (x1 < 0 || x1 > FRAME_WIDTH || x2 < 0 || x2 > FRAME_WIDTH) return null;
  if (y1 < 0 || y1 > FRAME_HEIGHT || y2 < 0 || y2 > FRAME_HEIGHT) return null;
  if (Math.hypot(x2 - x1, y2 - y1) < 10) return null;
  return values;
}

function validateCvCalibration(config) {
  const counter = config?.cv?.counter;
  if (!counter?.enabled) return { ok: true, errors: [] };

  const errors = [];
  const cameraIds = new Set((config.cameras || []).map(camera => camera.id));
  if (counter.mode === 'dual') {
    for (const [role, label] of [['entry', 'Acesso A'], ['exit', 'Acesso B']]) {
      const unit = counter[role];
      if (!unit || !cameraIds.has(unit.camera)) errors.push(`${label}: câmera inválida`);
      if (!parseLine(unit?.line)) errors.push(`${label}: linha deve ter 4 coordenadas válidas em 1920x1080`);
    }
  } else {
    if (!cameraIds.has(counter.camera)) errors.push('Contador: câmera inválida');
    if (!parseLine(counter.line)) errors.push('Contador: linha deve ter 4 coordenadas válidas em 1920x1080');
  }

  const model = counter.model;
  if (model != null && (typeof model !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(model))) {
    errors.push('Contador: nome de modelo inválido');
  }
  return { ok: errors.length === 0, errors };
}

module.exports = { FRAME_WIDTH, FRAME_HEIGHT, parseLine, validateCvCalibration };
