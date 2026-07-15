'use strict';

const path = require('path');
const fs = require('fs');
const cvLogger = require('../data/cv-logger');
const cvReport = require('../data/cv-report');

// CV + ReID routes extracted from server/index.js
// Lines 867-1018
module.exports = function(app, cluster) {
  const { cvManager } = cluster;

  app.get('/api/cv/status', (req, res) => {
    res.json({ ok: true, data: cvManager.getStatus() });
  });

  app.get('/api/cv/count', (req, res) => {
    // getCounts() não existe — usa getStatus() que inclui totalCount e zones
    const status = cvManager.getStatus();
    res.json({ ok: true, data: { totalCount: status.totalCount, zones: status.zones, counter: status.counter } });
  });

  app.get('/api/cv/detections', (req, res) => {
    // getAllDetections() não existe — agrega por câmera via getStatus().perCamera
    const status = cvManager.getStatus();
    const all = {};
    for (const [camId, cam] of Object.entries(status.perCamera || {})) {
      const det = cvManager.getDetections(camId);
      if (det) all[camId] = det;
    }
    res.json({ ok: true, data: all });
  });

  app.get('/api/cv/:camId/detections', (req, res) => {
    res.json({ ok: true, data: cvManager.getDetections(req.params.camId) });
  });

  app.get('/api/cv/heatmap', (req, res) => {
    const heatmap = cvManager.getHeatmap();
    if (!heatmap) return res.status(404).json({ ok: false, error: 'No heatmap', code: 'NOT_FOUND' });
    res.set('Content-Type', 'image/png');
    res.send(heatmap);
  });

  app.get('/api/cv/:camId/heatmap', (req, res) => {
    const heatmap = cvManager.getHeatmap(req.params.camId);
    if (!heatmap) return res.status(404).json({ ok: false, error: 'No heatmap', code: 'NOT_FOUND' });
    res.set('Content-Type', 'image/png');
    res.send(heatmap);
  });

  app.get('/api/cv/frame', (req, res) => {
    const frame = cvManager.getFrame();
    if (!frame) return res.status(404).json({ ok: false, error: 'No frame', code: 'NOT_FOUND' });
    res.set('Content-Type', 'image/jpeg');
    res.send(frame);
  });

  app.get('/api/cv/:camId/frame', (req, res) => {
    const frame = cvManager.getFrame(req.params.camId);
    if (!frame) return res.status(404).json({ ok: false, error: 'No frame', code: 'NOT_FOUND' });
    res.set('Content-Type', 'image/jpeg');
    res.send(frame);
  });

  app.get('/api/cv/counter', (req, res) => {
    res.json({ ok: true, data: cvManager.getCounterData() });
  });

  app.get('/api/cv/counter/frame', (req, res) => {
    const frame = cvManager.getCounterFrame();
    if (!frame) return res.status(404).json({ ok: false, error: 'No counter frame', code: 'NOT_FOUND' });
    res.set('Content-Type', 'image/jpeg');
    res.send(frame);
  });

  app.post('/api/cv/start', (req, res) => {
    try {
      cvManager.start();
      res.json({ ok: true, data: { message: 'CV started' } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'CV_START_FAILED' });
    }
  });

  app.post('/api/cv/stop', (req, res) => {
    cvManager.stop();
    res.json({ ok: true, data: { message: 'CV stopped' } });
  });

  app.post('/api/cv/heatmap/reset', (req, res) => {
    cvManager.resetHeatmap();
    res.json({ ok: true, data: { message: 'Heatmap reset' } });
  });

  app.get('/api/cv/counter/history', (req, res) => {
    const days = cvLogger.listDays().map(day => {
      const summary = cvLogger.getDailySummary(day.date);
      return {
        ...day,
        counter: summary?.counter || null,
        peak: summary?.peak || null,
      };
    });
    res.json({ ok: true, data: days });
  });

  app.get('/api/cv/counter/history/:date', (req, res) => {
    const summary = cvLogger.getDailySummary(req.params.date);
    if (summary?.counter) return res.json({ ok: true, data: summary.counter });

    const legacyCounterFile = path.join(__dirname, 'python', 'output', 'counter', `daily-${req.params.date}.json`);
    if (!fs.existsSync(legacyCounterFile)) {
      return res.status(404).json({ ok: false, error: 'No data for this date', code: 'NOT_FOUND' });
    }
    try {
      return res.json({ ok: true, data: JSON.parse(fs.readFileSync(legacyCounterFile, 'utf8')) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message, code: 'COUNTER_HISTORY_ERROR' });
    }
  });

  app.get('/api/cv/daily', (req, res) => {
    res.json({ ok: true, data: cvLogger.listDays() });
  });

  app.get('/api/cv/daily/:date', (req, res) => {
    const summary = cvLogger.getDailySummary(req.params.date);
    if (!summary) return res.status(404).json({ ok: false, error: 'No data for this date', code: 'NOT_FOUND' });
    res.json({ ok: true, data: summary });
  });

  app.get('/api/cv/daily/today/summary', (req, res) => {
    const summary = cvLogger.getDailySummary();
    if (!summary) return res.json({ ok: true, data: { samples: 0, message: 'No samples yet' } });
    res.json({ ok: true, data: summary });
  });

  // Reports
  app.get('/api/cv/report/week', (req, res) => {
    res.json({ ok: true, data: cvReport.thisWeek() });
  });

  app.get('/api/cv/report/month', (req, res) => {
    res.json({ ok: true, data: cvReport.thisMonth() });
  });

  app.get('/api/cv/report/last7', (req, res) => {
    res.json({ ok: true, data: cvReport.last7() });
  });

  app.get('/api/cv/report/last30', (req, res) => {
    res.json({ ok: true, data: cvReport.last30() });
  });

  app.get('/api/cv/report/:from/:to', (req, res) => {
    const { from, to } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ ok: false, error: 'Format: YYYY-MM-DD', code: 'INVALID_DATE_FORMAT' });
    }
    res.json({ ok: true, data: cvReport.aggregate(from, to) });
  });

  // ─── ReID Routes ───────────────────────────────────────────────────────────

  app.get('/api/reid/today', (req, res) => {
    const data = cvManager.getReidToday();
    if (!data) {
      return res.status(404).json({ ok: false, error: 'No ReID data available', code: 'NO_REID_DATA' });
    }
    res.json({ ok: true, data });
  });

  app.get('/api/reid/stats', (req, res) => {
    const data = cvManager.getReidStats();
    res.json({ ok: true, data });
  });
};
