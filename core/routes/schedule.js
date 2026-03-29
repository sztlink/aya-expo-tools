'use strict';

// Schedule routes
module.exports = function(app, { scheduler }) {
  app.get('/api/schedule', (req, res) => {
    res.json({ ok: true, data: scheduler.getStatus() });
  });

  app.post('/api/schedule/open', async (req, res) => {
    try {
      await scheduler.executeOpen();
      res.json({ ok: true, data: { message: 'Exhibition opened' } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'OPEN_FAILED' });
    }
  });

  app.post('/api/schedule/close', async (req, res) => {
    try {
      await scheduler.executeClose();
      res.json({ ok: true, data: { message: 'Exhibition closed' } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'CLOSE_FAILED' });
    }
  });
};
