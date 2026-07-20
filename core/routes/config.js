// core/routes/config.js
const fs = require('fs');
const path = require('path');
const { validateCvCalibration } = require('../../clusters/cv/calibration-config');

module.exports = function(app, { config, configName, configPath, projectors, cameras, scheduler, cvManager }) {
  // ─── API: Exhibition Info ──────────────────────────────────
  app.get('/api/info', (req, res) => {
    res.json({
      exhibition: config.exhibition,
      slug: config.exhibition.slug || null,
      projetoId: config.exhibition.projetoId || null,
      projectorCount: config.projectors.length,
      cameraCount: config.cameras.length,
      uptime: process.uptime(),
    });
  });

  // ─── API: Config editor ────────────────────────────────────
  app.get('/api/config', (req, res) => {
    res.json(config);
  });

  app.put('/api/config', (req, res) => {
    try {
      const updated = req.body;
      const operational = scheduler?.getStatus?.();
      if (operational) {
        const noTransition = !operational.transition && (operational.pendingTransitions?.length || 0) === 0;
        const stable = ['open', 'closed'].includes(operational.state)
          && operational.state === operational.desiredState
          && noTransition;
        const cvChanged = JSON.stringify(updated?.cv ?? null) !== JSON.stringify(config?.cv ?? null);
        const cvRuntime = cvManager?.getStatus?.();
        // A closed-day boot may be degraded only because powered-down projectors
        // cannot answer PJLink. CV maintenance is still safe when desired state is
        // closed, no transition is queued, and no CV worker is running.
        const cvMaintenanceWindow = operational.desiredState === 'closed'
          && noTransition
          && cvRuntime?.running !== true;
        if ((cvChanged && !cvMaintenanceWindow) || (!cvChanged && !stable)) {
          return res.status(409).json({
            ok: false,
            error: cvChanged
              ? 'CV configuration changes require the exhibition to be stably closed'
              : 'Configuration changes are blocked during operational transitions',
            code: cvChanged ? 'CV_MAINTENANCE_WINDOW_REQUIRED' : 'SCHEDULE_TRANSITION',
          });
        }
      }
      const calibration = validateCvCalibration(updated);
      if (!calibration.ok) {
        return res.status(400).json({ ok: false, error: calibration.errors.join('; '), code: 'INVALID_CV_CALIBRATION', errors: calibration.errors });
      }
      const cfgPath = path.join(__dirname, '..', '..', 'config', `${configName}.json`);
      fs.writeFileSync(cfgPath, JSON.stringify(updated, null, 2));
      // Update in-memory config and reload all managers
      Object.assign(config, updated);
      if (projectors?.reload) projectors.reload(config);
      if (cameras?.reload) cameras.reload(config);
      if (scheduler?.updateConfig) scheduler.updateConfig(config);
      if (cvManager?.reload) cvManager.reload(config);
      res.json({ ok: true, config: updated });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/config/test/projector/:i', async (req, res) => {
    const p = config.projectors[parseInt(req.params.i)];
    if (!p) return res.status(404).json({ ok: false });
    try {
      const pingOk = await new Promise(resolve => {
        const { exec } = require('child_process');
        exec(`ping -n 1 -w 2000 ${p.ip}`, (err, out) => resolve(!err && (out.includes('TTL=') || out.includes('Reply'))));
      });
      if (!pingOk) return res.json({ ok: false, message: `${p.ip} não responde ao ping. Verifique se está ligado e conectado.` });
      const portOk = await new Promise(resolve => {
        const net2 = require('net');
        const s = new net2.Socket();
        s.setTimeout(2000);
        s.connect(4352, p.ip, () => { s.destroy(); resolve(true); });
        s.on('error', () => resolve(false));
        s.on('timeout', () => resolve(false));
      });
      res.json({ ok: portOk, message: portOk ? `${p.name} respondendo via PJLink` : `${p.ip} responde ao ping mas PJLink (porta 4352) não está acessível` });
    } catch(e) { res.json({ ok: false, message: e.message }); }
  });

  app.post('/api/config/test/camera/:i', async (req, res) => {
    const c = config.cameras[parseInt(req.params.i)];
    if (!c) return res.status(404).json({ ok: false });
    try {
      const portOk = await new Promise(resolve => {
        const net2 = require('net');
        const s = new net2.Socket();
        s.setTimeout(3000);
        s.connect(554, c.ip, () => { s.destroy(); resolve(true); });
        s.on('error', () => resolve(false));
        s.on('timeout', () => resolve(false));
      });
      res.json({ ok: portOk, message: portOk ? `${c.name} acessível` : `${c.ip} não responde. Verifique o IP e a conexão.` });
    } catch(e) { res.json({ ok: false, message: e.message }); }
  });

  app.post('/api/config/test/plug/:i', async (req, res) => {
    const p = (config.smartplugs || [])[parseInt(req.params.i)];
    if (!p) return res.status(404).json({ ok: false });
    try {
      const pingOk = await new Promise(resolve => {
        const { exec } = require('child_process');
        exec(`ping -n 1 -w 2000 ${p.ip}`, (err, out) => resolve(!err && (out.includes('TTL=') || out.includes('Reply'))));
      });
      res.json({ ok: pingOk, message: pingOk ? `${p.name} respondendo` : `${p.ip} não responde. Verifique o IP e a conexão.` });
    } catch(e) { res.json({ ok: false, message: e.message }); }
  });
};
