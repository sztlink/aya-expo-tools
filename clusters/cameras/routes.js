'use strict';

// Camera + timelapse routes extracted from server/index.js
// Lines 244-298 (cameras), 1081-1118 (timelapse)
module.exports = function(app, cluster) {
  const { cameras, timelapse } = cluster;

  // --- Cameras ---
  app.get('/api/cameras', (req, res) => {
    res.json({ ok: true, data: cameras.getAllStatus() });
  });

  app.post('/api/cameras/check', async (req, res) => {
    try {
      const results = await cameras.checkAll();
      res.json({ ok: true, data: results });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'CAMERA_CHECK_FAILED' });
    }
  });

  app.get('/api/cameras/:id/snapshot', async (req, res) => {
    try {
      const cam = cameras.getById(req.params.id);
      if (!cam) return res.status(404).json({ ok: false, error: 'Camera not found', code: 'NOT_FOUND' });
      const snapshot = await cameras.getSnapshot(cam);
      if (!snapshot) return res.status(500).json({ ok: false, error: 'Snapshot failed', code: 'SNAPSHOT_FAILED' });
      res.set('Content-Type', 'image/jpeg');
      res.send(snapshot);
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'SNAPSHOT_FAILED' });
    }
  });

  // --- Timelapse ---
  app.get('/api/timelapse/stats', (req, res) => {
    res.json({ ok: true, data: timelapse.getStats ? timelapse.getStats() : {} });
  });

  app.get('/api/timelapse/dates', (req, res) => {
    res.json({ ok: true, data: timelapse.getDates ? timelapse.getDates() : [] });
  });

  app.get('/api/timelapse/:date/cameras', (req, res) => {
    res.json({ ok: true, data: timelapse.getCameras ? timelapse.getCameras(req.params.date) : [] });
  });

  app.get('/api/timelapse/:date/:camId/frames', (req, res) => {
    res.json({ ok: true, data: timelapse.getFrames ? timelapse.getFrames(req.params.date, req.params.camId) : [] });
  });

  app.get('/api/timelapse/:date/:camId/:filename', (req, res) => {
    const framePath = timelapse.getFramePath ? timelapse.getFramePath(req.params.date, req.params.camId, req.params.filename) : null;
    if (!framePath) return res.status(404).json({ ok: false, error: 'Frame not found', code: 'NOT_FOUND' });
    res.sendFile(framePath);
  });

  app.get('/api/timelapse/:date/:camId/at/:time', (req, res) => {
    const framePath = timelapse.getFrameAt ? timelapse.getFrameAt(req.params.date, req.params.camId, req.params.time) : null;
    if (!framePath) return res.status(404).json({ ok: false, error: 'Frame not found', code: 'NOT_FOUND' });
    res.sendFile(framePath);
  });
};
