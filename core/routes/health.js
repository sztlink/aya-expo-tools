// core/routes/health.js
module.exports = function(app, { config, network, serverHealth, cvManager, projectors, cameras, scheduler }) {
  // ─── API: Server Health (GPU, CPU, RAM, disco) ────────────
  app.get('/api/server/health', (req, res) => {
    const current = serverHealth.getCurrent();
    if (!current) {
      return res.json({ status: 'initializing', message: 'First poll not yet complete' });
    }
    res.json(current);
  });

  app.get('/api/server/history', (req, res) => {
    res.json(serverHealth.getHistory());
  });

  app.get('/api/server/alerts', (req, res) => {
    res.json(serverHealth.getAlerts());
  });

  // Log dates available
  app.get('/api/server/logs', (req, res) => {
    res.json(serverHealth.getLogDates());
  });

  // Log for a specific date (with optional time range and downsampling)
  // ?from=09:00&to=20:00&downsample=300 (5min intervals)
  app.get('/api/server/logs/:date', (req, res) => {
    const { date } = req.params;
    const { from, to, downsample } = req.query;
    const entries = serverHealth.readLog(date, {
      from: from || undefined,
      to: to || undefined,
      downsample: downsample ? parseInt(downsample) : undefined,
    });
    res.json(entries);
  });

  // Daily summary
  app.get('/api/server/summary/:date', (req, res) => {
    const summary = serverHealth.dailySummary(req.params.date);
    if (!summary) return res.json({ error: 'No data for this date' });
    res.json(summary);
  });

  // ─── API: Health ───────────────────────────────────────────
  app.get('/api/health', async (req, res) => {
    const inet = await network.checkInternet();
    const cvStatus = cvManager ? cvManager.getStatus() : { enabled: false, running: false };
    const sh = serverHealth.getCurrent();
    res.json({
      status: 'ok',
      exhibition: config.exhibition.name,
      uptime: Math.floor(process.uptime()),
      projectors: projectors.getAllStatus().length,
      cameras: cameras.getAllStatus().length,
      tvs: (config.tvs || []).length,
      internet: inet.online,
      schedule: scheduler.enabled,
      cv: { enabled: cvStatus.enabled, running: cvStatus.running, count: cvStatus.detections?.count ?? null },
      server: sh ? {
        gpus: sh.gpus,
        cpu: sh.cpu,
        ram: sh.ram,
        disk: sh.disk,
        resolume: sh.resolume,
        osUptime: sh.osUptime,
        alerts: sh.alerts || [],
      } : null,
      timestamp: new Date().toISOString(),
    });
  });
};
