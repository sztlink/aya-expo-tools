'use strict';

// Schedule routes
module.exports = function(app, { scheduler }) {
  const getAuditContext = (req, action) => {
    const audit = req.body?._audit || req.body?.audit || {};
    const source = audit.source || (req.headers['x-remote-command'] === 'true' ? 'portal' : 'manual');
    const actor = audit.who || req.body?.by || null;
    return { source, actor, reason: audit.action || action };
  };

  app.get('/api/schedule', (req, res) => {
    res.json({ ok: true, data: scheduler.getStatus() });
  });

  app.post('/api/schedule/open', async (req, res) => {
    try {
      await scheduler.executeOpen(getAuditContext(req, 'schedule-open'));
      res.json({ ok: true, data: { message: 'Exhibition opened' } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'OPEN_FAILED' });
    }
  });

  app.post('/api/schedule/close', async (req, res) => {
    try {
      await scheduler.executeClose(getAuditContext(req, 'schedule-close'));
      res.json({ ok: true, data: { message: 'Exhibition closed' } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'CLOSE_FAILED' });
    }
  });
};
