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

  const runTransition = async (req, res, action) => {
    const opening = action === 'open';
    const message = opening ? 'Exhibition opened' : 'Exhibition closed';
    const code = opening ? 'OPEN_FAILED' : 'CLOSE_FAILED';

    try {
      const result = opening
        ? await scheduler.executeOpen(getAuditContext(req, 'schedule-open'))
        : await scheduler.executeClose(getAuditContext(req, 'schedule-close'));
      const status = scheduler.getStatus();
      const data = { message, result, status };

      // Backward-compatible success envelope, now with transition detail. A
      // resolved cluster result with ok:false is still an HTTP failure.
      if (result && result.ok === false) {
        const error = result.errors?.map(item => item.message).filter(Boolean).join('; ')
          || `${opening ? 'Open' : 'Close'} transition degraded`;
        return res.status(500).json({ ok: false, error, code, data });
      }

      return res.json({ ok: true, data });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: err.message,
        code,
        data: { status: scheduler.getStatus() },
      });
    }
  };

  app.post('/api/schedule/open', (req, res) => runTransition(req, res, 'open'));
  app.post('/api/schedule/close', (req, res) => runTransition(req, res, 'close'));
};
