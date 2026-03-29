'use strict';

// CV + ReID routes extracted from server/index.js
// Lines 867-1018
module.exports = function(app, cluster) {
  const { cvManager } = cluster;

  app.get('/api/cv/status', (req, res) => {
    res.json({ ok: true, data: cvManager.getStatus() });
  });

  app.get('/api/cv/count', (req, res) => {
    const counts = cvManager.getCounts();
    res.json({ ok: true, data: counts });
  });

  app.get('/api/cv/detections', (req, res) => {
    res.json({ ok: true, data: cvManager.getAllDetections() });
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
    res.json({ ok: true, data: cvManager.getCounterHistory() });
  });

  app.get('/api/cv/counter/history/:date', (req, res) => {
    res.json({ ok: true, data: cvManager.getCounterHistory(req.params.date) });
  });

  app.get('/api/cv/daily', (req, res) => {
    res.json({ ok: true, data: cvManager.getDailyData() });
  });

  app.get('/api/cv/daily/:date', (req, res) => {
    res.json({ ok: true, data: cvManager.getDailyData(req.params.date) });
  });

  app.get('/api/cv/daily/today/summary', (req, res) => {
    res.json({ ok: true, data: cvManager.getTodaySummary() });
  });

  // Reports (delegate to data cluster later, for now direct)
  app.get('/api/cv/report/week', (req, res) => {
    res.json({ ok: true, data: cvManager.getReport ? cvManager.getReport('week') : {} });
  });

  app.get('/api/cv/report/month', (req, res) => {
    res.json({ ok: true, data: cvManager.getReport ? cvManager.getReport('month') : {} });
  });

  app.get('/api/cv/report/last7', (req, res) => {
    res.json({ ok: true, data: cvManager.getReport ? cvManager.getReport('last7') : {} });
  });

  app.get('/api/cv/report/last30', (req, res) => {
    res.json({ ok: true, data: cvManager.getReport ? cvManager.getReport('last30') : {} });
  });

  app.get('/api/cv/report/:from/:to', (req, res) => {
    res.json({ ok: true, data: cvManager.getReport ? cvManager.getReport(req.params.from, req.params.to) : {} });
  });
};
