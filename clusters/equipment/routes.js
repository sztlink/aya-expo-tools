/**
 * Equipment Cluster Routes
 * Projectors, TVs, Audio, Media
 */

const fs = require('fs');
const path = require('path');

module.exports = function(app, cluster) {
  const { projectors, tv, tuya, audio, loopGen, config, addLogEntry, isRemoteCommand } = cluster;

  // ─── Projectors (7 routes) ────────────────────────────────

  app.get('/api/projectors', (req, res) => {
    try {
      res.json({ ok: true, data: projectors.getAllStatus() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'PROJECTORS_STATUS_ERROR' });
    }
  });

  app.post('/api/projectors/poll', async (req, res) => {
    try {
      const status = await projectors.pollAll();
      cluster.broadcast('projectors', status);
      res.json({ ok: true, data: status });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'PROJECTORS_POLL_ERROR' });
    }
  });

  app.post('/api/projectors/all/on', async (req, res) => {
    try {
      await projectors.powerOnAll();
      setTimeout(() => projectors.pollAll().then(s => cluster.broadcast('projectors', s)), 3000);
      res.json({ ok: true, data: { action: 'power-on-all' } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'PROJECTORS_ON_ERROR' });
    }
  });

  app.post('/api/projectors/all/off', async (req, res) => {
    try {
      await projectors.powerOffAll();
      setTimeout(() => projectors.pollAll().then(s => cluster.broadcast('projectors', s)), 3000);
      res.json({ ok: true, data: { action: 'power-off-all' } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'PROJECTORS_OFF_ERROR' });
    }
  });

  app.post('/api/projectors/:id/on', async (req, res) => {
    try {
      const p = projectors.get(req.params.id);
      if (!p) return res.status(404).json({ ok: false, error: 'Projector not found', code: 'PROJECTOR_NOT_FOUND' });
      await p.powerOn();
      setTimeout(() => p.poll().then(s => cluster.broadcast('projector', s)), 3000);
      res.json({ ok: true, data: { id: p.id, action: 'power-on' } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'PROJECTOR_ON_ERROR' });
    }
  });

  app.post('/api/projectors/:id/off', async (req, res) => {
    try {
      const p = projectors.get(req.params.id);
      if (!p) return res.status(404).json({ ok: false, error: 'Projector not found', code: 'PROJECTOR_NOT_FOUND' });
      await p.powerOff();
      setTimeout(() => p.poll().then(s => cluster.broadcast('projector', s)), 3000);
      res.json({ ok: true, data: { id: p.id, action: 'power-off' } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'PROJECTOR_OFF_ERROR' });
    }
  });

  app.post('/api/projectors/:id/input', async (req, res) => {
    try {
      const p = projectors.get(req.params.id);
      if (!p) return res.status(404).json({ ok: false, error: 'Projector not found', code: 'PROJECTOR_NOT_FOUND' });
      const { input } = req.body;
      if (!input) return res.status(400).json({ ok: false, error: 'input required', code: 'INPUT_REQUIRED' });
      await p.setInput(input);
      res.json({ ok: true, data: { id: p.id, input } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'PROJECTOR_INPUT_ERROR' });
    }
  });

  // ─── TVs (12 routes) ──────────────────────────────────────

  app.get('/api/tv', (req, res) => {
    try {
      const tvs = config.tvs || [];
      res.json({ ok: true, data: tvs.map(t => ({ ...t, password: undefined })) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'TV_LIST_ERROR' });
    }
  });

  // Bulk TV operations (must come before :id routes)
  app.post('/api/tv/all/on', async (req, res) => {
    try {
      const tvs = config.tvs || [];
      const results = await Promise.allSettled(tvs.map(t => tv.powerOn(t).then(() => ({ id: t.id, ok: true }))));
      res.json({ 
        ok: true, 
        data: results.map((r, i) => r.status === 'fulfilled' ? r.value : { id: tvs[i].id, ok: false, error: r.reason?.message })
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'TV_ALL_ON_ERROR' });
    }
  });

  app.post('/api/tv/all/off', async (req, res) => {
    try {
      const tvs = config.tvs || [];
      const results = await Promise.allSettled(tvs.map(t => tv.powerOff(t).then(() => ({ id: t.id, ok: true }))));
      res.json({ 
        ok: true, 
        data: results.map((r, i) => r.status === 'fulfilled' ? r.value : { id: tvs[i].id, ok: false, error: r.reason?.message })
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'TV_ALL_OFF_ERROR' });
    }
  });

  app.post('/api/tv/all/cast', async (req, res) => {
    try {
      const tvs = config.tvs || [];
      const mediaServer = config.exhibition?.network?.mediaServer || 'localhost';
      const port = config.server?.port || 3000;
      const baseUrl = `http://${mediaServer}:${port}`;

      const results = [];
      for (const t of tvs) {
        if (!t.videoUrl) { results.push({ id: t.id, ok: false, error: 'videoUrl não configurada' }); continue; }
        try {
          const result = await tv.startLoop(t, t.videoUrl, { title: t.videoTitle, baseUrl });
          if (result?.wakingUp) addLogEntry(`📺 ${t.name}: WOL enviado — cast automático em ~35s`);
          results.push({ id: t.id, ok: true, looping: true, wakingUp: result?.wakingUp || false });
        } catch (err) {
          results.push({ id: t.id, ok: false, error: err.message });
        }
      }
      res.json({ ok: true, data: results });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'TV_ALL_CAST_ERROR' });
    }
  });

  app.post('/api/tv/all/stop', async (req, res) => {
    try {
      const tvs = config.tvs || [];
      // Stop loops first
      for (const t of tvs) { tv.stopLoop(t); }
      const results = await Promise.allSettled(tvs.map(t => tv.castStop(t).then(r => ({ id: t.id, ok: true, ...r }))));
      res.json({ 
        ok: true, 
        data: results.map((r, i) => r.status === 'fulfilled' ? r.value : { id: tvs[i].id, ok: false, error: r.reason?.message })
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'TV_ALL_STOP_ERROR' });
    }
  });

  // Individual TV operations
  app.get('/api/tv/:id/status', async (req, res) => {
    try {
      const tvs = config.tvs || [];
      const t = tvs.find(t => t.id === req.params.id);
      if (!t) return res.status(404).json({ ok: false, error: 'TV não encontrada', code: 'TV_NOT_FOUND' });
      const status = await tv.getStatus(t);
      res.json({ ok: true, data: { id: t.id, name: t.name, ...status } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'TV_STATUS_ERROR' });
    }
  });

  app.post('/api/tv/:id/on', async (req, res) => {
    try {
      const tvs = config.tvs || [];
      const t = tvs.find(t => t.id === req.params.id);
      if (!t) return res.status(404).json({ ok: false, error: 'TV não encontrada', code: 'TV_NOT_FOUND' });
      await tv.powerOn(t);
      res.json({ ok: true, data: { message: `Wake-on-LAN enviado para ${t.name}` } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'TV_ON_ERROR' });
    }
  });

  app.post('/api/tv/:id/off', async (req, res) => {
    try {
      const tvs = config.tvs || [];
      const t = tvs.find(t => t.id === req.params.id);
      if (!t) return res.status(404).json({ ok: false, error: 'TV não encontrada', code: 'TV_NOT_FOUND' });
      const result = await tv.powerOff(t);
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'TV_OFF_ERROR' });
    }
  });

  app.post('/api/tv/:id/cast', async (req, res) => {
    try {
      const tvs = config.tvs || [];
      const t = tvs.find(t => t.id === req.params.id);
      if (!t) return res.status(404).json({ ok: false, error: 'TV não encontrada', code: 'TV_NOT_FOUND' });
      const { url, title } = req.body;
      const videoUrl = url || t.videoUrl;
      if (!videoUrl) return res.status(400).json({ ok: false, error: 'url obrigatória (body ou config tv.videoUrl)', code: 'URL_REQUIRED' });
      
      const mediaServer = config.exhibition?.network?.mediaServer || 'localhost';
      const port = config.server?.port || 3000;
      const baseUrl = `http://${mediaServer}:${port}`;
      const result = await tv.startLoop(t, videoUrl, { title: title || t.videoTitle, baseUrl });
      
      if (result?.wakingUp) {
        addLogEntry(`📺 ${t.name}: WOL enviado — cast automático em ~35s`);
      }
      res.json({ ok: true, data: { looping: true, wakingUp: result?.wakingUp || false, videoUrl } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'TV_CAST_ERROR' });
    }
  });

  app.post('/api/tv/:id/stop', async (req, res) => {
    try {
      const tvs = config.tvs || [];
      const t = tvs.find(t => t.id === req.params.id);
      if (!t) return res.status(404).json({ ok: false, error: 'TV não encontrada', code: 'TV_NOT_FOUND' });
      tv.stopLoop(t); // stop loop monitor
      const result = await tv.castStop(t);
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'TV_STOP_ERROR' });
    }
  });

  app.post('/api/tv/:id/volume', async (req, res) => {
    try {
      const tvs = config.tvs || [];
      const t = tvs.find(t => t.id === req.params.id);
      if (!t) return res.status(404).json({ ok: false, error: 'TV não encontrada', code: 'TV_NOT_FOUND' });
      const { level } = req.body;
      if (level === undefined) return res.status(400).json({ ok: false, error: 'level obrigatório (0-100)', code: 'LEVEL_REQUIRED' });
      const result = await tv.setVolume(t, level);
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'TV_VOLUME_ERROR' });
    }
  });

  app.get('/api/tv/loops', (req, res) => {
    try {
      res.json({ ok: true, data: tv.getLoopStatus() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'TV_LOOPS_ERROR' });
    }
  });

  // ─── Audio (2 routes) ─────────────────────────────────────

  app.get('/api/audio/volume', (req, res) => {
    try {
      const level = audio.getVolume();
      res.json({ ok: true, data: { level, muted: level === 0 } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'AUDIO_GET_ERROR' });
    }
  });

  app.post('/api/audio/volume', (req, res) => {
    try {
      const { level } = req.body;
      if (level === undefined || isNaN(Number(level))) {
        return res.status(400).json({ ok: false, error: 'level (0-100) obrigatório', code: 'LEVEL_REQUIRED' });
      }
      const result = audio.setVolume(Number(level));
      addLogEntry(`🔊 Volume: ${result}%` + (isRemoteCommand(req) ? ' (remoto)' : ''));
      res.json({ ok: true, data: { level: result } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'AUDIO_SET_ERROR' });
    }
  });

  // ─── Media (5 routes) ─────────────────────────────────────

  const MEDIA_DIR = path.join(__dirname, '..', '..', 'media');

  app.get('/api/media', (req, res) => {
    try {
      const files = fs.readdirSync(MEDIA_DIR)
        .filter(f => /\.(mp4|webm|mov|mkv|wav|mp3)$/i.test(f))
        .map(f => {
          const stat = fs.statSync(path.join(MEDIA_DIR, f));
          return {
            name: f,
            url: `/media/${f}`,
            size: stat.size,
            sizeMB: Math.round(stat.size / 1024 / 1024),
            modified: stat.mtime.toISOString(),
          };
        })
        .sort((a, b) => b.modified.localeCompare(a.modified));
      res.json({ ok: true, data: files });
    } catch (err) {
      res.json({ ok: true, data: [] });
    }
  });

  app.post('/api/media/upload', (req, res) => {
    const filename = req.headers['x-filename'];
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ ok: false, error: 'Header X-Filename required', code: 'FILENAME_REQUIRED' });
    }

    // Sanitize filename
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!/\.(mp4|webm|mov|mkv|wav|mp3)$/i.test(safe)) {
      return res.status(400).json({ ok: false, error: 'Formato não suportado. Use: mp4, webm, mov, mkv, wav, mp3', code: 'INVALID_FORMAT' });
    }

    const filePath = path.join(MEDIA_DIR, safe);
    const ws = fs.createWriteStream(filePath);
    let bytes = 0;

    req.on('data', chunk => { bytes += chunk.length; ws.write(chunk); });
    req.on('end', () => {
      ws.end();
      addLogEntry(`📁 Arquivo carregado: ${safe} (${Math.round(bytes / 1024 / 1024)}MB)`);
      res.json({ ok: true, data: { name: safe, url: `/media/${safe}`, size: bytes, sizeMB: Math.round(bytes / 1024 / 1024) } });
    });
    req.on('error', err => {
      ws.destroy();
      try { fs.unlinkSync(filePath); } catch {}
      res.status(500).json({ ok: false, error: err.message, code: 'UPLOAD_ERROR' });
    });
  });

  app.delete('/api/media/:filename', (req, res) => {
    try {
      const safe = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = path.join(MEDIA_DIR, safe);
      if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: 'Not found', code: 'FILE_NOT_FOUND' });
      fs.unlinkSync(filePath);
      addLogEntry(`🗑️ Arquivo removido: ${safe}`);
      res.json({ ok: true, data: { deleted: safe } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'DELETE_ERROR' });
    }
  });

  app.post('/api/media/assign', async (req, res) => {
    try {
      const { tvId, videoUrl, videoTitle, recast } = req.body;
      if (!tvId || !videoUrl) return res.status(400).json({ ok: false, error: 'tvId and videoUrl required', code: 'PARAMS_REQUIRED' });

      const tvConf = (config.tvs || []).find(t => t.id === tvId);
      if (!tvConf) return res.status(404).json({ ok: false, error: `TV ${tvId} not found`, code: 'TV_NOT_FOUND' });

      // Resolve source file path
      const sourceFile = videoUrl.startsWith('/media/')
        ? path.join(MEDIA_DIR, videoUrl.replace('/media/', ''))
        : path.join(MEDIA_DIR, path.basename(videoUrl));

      if (!fs.existsSync(sourceFile)) {
        return res.status(404).json({ ok: false, error: `Arquivo não encontrado: ${sourceFile}`, code: 'SOURCE_NOT_FOUND' });
      }

      // Update config — store original URL and loop URL
      tvConf.videoUrlOriginal = videoUrl;
      if (videoTitle) tvConf.videoTitle = videoTitle;

      addLogEntry(`📺 Vídeo atribuído: ${tvId} → ${videoUrl} (gerando loop 12h...)`);

      // Generate loop in background
      const mediaServer = config.exhibition?.network?.mediaServer || 'localhost';
      const port = config.server?.port || 3000;
      const baseUrl = `http://${mediaServer}:${port}`;

      // Check if loop already exists
      if (loopGen.hasLoop(videoUrl)) {
        const loopUrl = loopGen.getLoopUrl(videoUrl);
        tvConf.videoUrl = loopUrl;
        cluster.persistTvConfig(tvId, tvConf);
        addLogEntry(`✅ Loop já existe: ${tvId} → ${loopUrl}`);

        if (recast) {
          tv.startLoop(tvConf, loopUrl, { title: videoTitle || tvConf.name, baseUrl });
        }
        return res.json({ ok: true, data: { loop: true, loopUrl, message: `Loop existente atribuído a ${tvConf.name}` } });
      }

      // Generate loop async — respond immediately, cast when ready
      res.json({ ok: true, data: { loop: false, generating: true, message: `Gerando loop 12h para ${tvConf.name}... Cast automático quando pronto.` } });

      loopGen.generate(sourceFile, (loopUrl) => {
        tvConf.videoUrl = loopUrl;
        cluster.persistTvConfig(tvId, tvConf);
        addLogEntry(`✅ Loop gerado: ${tvId} → ${loopUrl}`);

        if (recast) {
          tv.startLoop(tvConf, loopUrl, { title: videoTitle || tvConf.name, baseUrl });
          addLogEntry(`▶ Cast iniciado: ${tvId} → ${loopUrl}`);
        }
      }).catch(err => {
        addLogEntry(`❌ Erro ao gerar loop: ${tvId} — ${err.message}`);
        // Fallback: use original video
        tvConf.videoUrl = videoUrl;
        cluster.persistTvConfig(tvId, tvConf);
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'ASSIGN_ERROR' });
    }
  });

  app.get('/api/media/loops', (req, res) => {
    try {
      res.json({ ok: true, data: loopGen.getStatus() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'LOOPS_ERROR' });
    }
  });

  // ─── Smart Plugs (6 routes) ───────────────────────────────

  app.get('/api/plugs', async (req, res) => {
    try {
      const plugs = config.smartplugs || [];
      if (!tuya.isConfigured() || plugs.length === 0) return res.json({ ok: true, data: [] });
      const status = await tuya.allStatus(plugs);
      res.json({ ok: true, data: status });
    } catch (err) {
      const plugs = config.smartplugs || [];
      res.json({ ok: true, data: plugs.map(p => ({ id: p.id, controls: p.controls, on: null, error: err.message })) });
    }
  });

  app.post('/api/plugs/all/on', async (req, res) => {
    try {
      const plugs = config.smartplugs || [];
      const results = await tuya.allOn(plugs);
      addLogEntry('🔌 Smart plugs ligados' + (isRemoteCommand(req) ? ' (remoto)' : ''));
      res.json({ ok: true, data: results });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'PLUGS_ON_ERROR' });
    }
  });

  app.post('/api/plugs/all/off', async (req, res) => {
    try {
      const plugs = config.smartplugs || [];
      const results = await tuya.allOff(plugs);
      addLogEntry('🔌 Smart plugs desligados' + (isRemoteCommand(req) ? ' (remoto)' : ''));
      res.json({ ok: true, data: results });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'PLUGS_OFF_ERROR' });
    }
  });

  app.post('/api/plugs/:id/on', async (req, res) => {
    try {
      const plug = (config.smartplugs || []).find(p => p.id === req.params.id);
      if (!plug) return res.status(404).json({ ok: false, error: 'Plug not found', code: 'PLUG_NOT_FOUND' });
      await tuya.turnOn(plug.deviceId);
      addLogEntry('🔌 ' + plug.name + ' ligado' + (isRemoteCommand(req) ? ' (remoto)' : ''));
      res.json({ ok: true, data: { id: plug.id, state: 'on' } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'PLUG_ON_ERROR' });
    }
  });

  app.post('/api/plugs/:id/off', async (req, res) => {
    try {
      const plug = (config.smartplugs || []).find(p => p.id === req.params.id);
      if (!plug) return res.status(404).json({ ok: false, error: 'Plug not found', code: 'PLUG_NOT_FOUND' });
      await tuya.turnOff(plug.deviceId);
      addLogEntry('🔌 ' + plug.name + ' desligado' + (isRemoteCommand(req) ? ' (remoto)' : ''));
      res.json({ ok: true, data: { id: plug.id, state: 'off' } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, code: 'PLUG_OFF_ERROR' });
    }
  });
};
