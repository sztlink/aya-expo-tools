'use strict';

module.exports = function(app, { readLog, addLogEntry }) {
  app.get('/api/log', (_req, res) => {
    res.json(readLog());
  });

  app.post('/api/log', (req, res) => {
    const {
      message,
      type,
      actor,
      action,
      source,
      targetId,
      details,
      timestamp,
    } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }

    addLogEntry({
      message,
      type: type || 'manual',
      actor: actor || null,
      action: action || null,
      source: source || null,
      targetId: targetId || null,
      details: details || null,
      timestamp: timestamp || new Date().toISOString(),
    });

    res.json({ ok: true });
  });
};
