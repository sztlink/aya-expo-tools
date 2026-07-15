/**
 * Equipment Cluster
 * Manages projectors, TVs, audio, and media
 */

const { ProjectorManager } = require('./pjlink');
const tv = require('./tv');
const tuya = require('./tuya');
const audio = require('./audio');
const loopGen = require('./loop-generator');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'equipment',
  requires: [],

  register(app, config, clusters) {
    // Initialize managers
    this.projectors = new ProjectorManager(config);
    this.tv = tv;
    this.tuya = tuya;
    this.audio = audio;
    this.loopGen = loopGen;
    this.config = config;
    this.app = app;
    this.clusters = clusters;

    // Store broadcast function for routes to use
    this.broadcast = (type, data) => {
      if (clusters.core && clusters.core.broadcast) {
        clusters.core.broadcast(type, data);
      }
    };

    // Helper functions for routes
    this.addLogEntry = (message, type = 'system') => {
      if (clusters.core && clusters.core.addLogEntry) {
        clusters.core.addLogEntry(message, type);
      }
    };

    this.isRemoteCommand = (req) => {
      return req.headers['x-remote-command'] === 'true';
    };

    this.persistTvConfig = (tvId, tvConf) => {
      try {
        const configName = path.basename(config._configPath || '', '.json');
        const configPath = path.join(__dirname, '..', '..', 'config', `${configName}.json`);
        const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const savedTv = (saved.tvs || []).find(t => t.id === tvId);
        if (savedTv) {
          Object.assign(savedTv, { 
            videoUrl: tvConf.videoUrl, 
            videoUrlOriginal: tvConf.videoUrlOriginal, 
            videoTitle: tvConf.videoTitle 
          });
          fs.writeFileSync(configPath, JSON.stringify(saved, null, 2));
        }
      } catch (err) {
        console.error('Failed to persist TV config:', err.message);
      }
    };

    // Register routes
    const registerRoutes = require('./routes');
    registerRoutes(app, this);

    // Polling lifecycle is owned by core.startManagers(). Starting here would
    // race the boot reconciliation power commands with duplicate PJLink polls.
    console.log(`  ✓ Equipment cluster loaded (${config.projectors?.length || 0} projectors, ${config.tvs?.length || 0} TVs)`);
  },

  async onOpen() {
    console.log('  🟢 Equipment: Opening...');
    const errors = [];

    try {
      const projectorResults = await this.projectors.powerOnAll();
      projectorResults.forEach((result, index) => {
        if (result.status === 'rejected' || result.value?.ok === false) {
          const id = this.config.projectors?.[index]?.id || `projector-${index + 1}`;
          errors.push({ component: id, error: result.reason?.message || result.value?.error || 'power-on failed' });
        }
      });
      console.log(`  ✓ Projector power-on sent (${projectorResults.length - errors.length}/${projectorResults.length})`);

      const plugs = this.config.smartplugs || [];
      if (plugs.length > 0) {
        if (!this.tuya.isConfigured()) {
          errors.push({ component: 'smartplugs', error: 'Tuya credentials unavailable' });
        } else {
          const plugResults = await this.tuya.allOn(plugs);
          errors.push(...plugResults.filter(result => !result.ok).map(result => ({ component: result.id, error: result.error || 'power-on failed' })));
        }
      }

      const tvs = this.config.tvs || [];
      const tvResults = await Promise.allSettled(tvs.map(t => this.tv.powerOn(t)));
      tvResults.forEach((result, index) => {
        if (result.status === 'rejected' || result.value?.ok === false) {
          errors.push({ component: tvs[index]?.id || `tv-${index + 1}`, error: result.reason?.message || result.value?.error || 'power-on failed' });
        }
      });

      try {
        const targetVolume = Number(this.config.audio?.volume);
        const openVolume = Number.isFinite(targetVolume) ? targetVolume : 70;
        const result = this.audio.setVolume(openVolume);
        console.log(`  ✓ Audio volume restored to ${result}%`);
      } catch (err) {
        errors.push({ component: 'audio', error: err.message });
      }

      setTimeout(() => {
        this.projectors.pollAll().then(s => this.broadcast('projectors', s)).catch(() => {});
      }, 5000);

      return errors.length === 0
        ? { ok: true, message: 'Equipment opened' }
        : { ok: false, error: `${errors.length} equipment open action(s) failed`, errors };
    } catch (err) {
      console.error('  ❌ Equipment onOpen error:', err.message);
      return { ok: false, error: err.message, errors: [...errors, { component: 'equipment', error: err.message }] };
    }
  },

  async onClose() {
    console.log('  🔴 Equipment: Closing...');
    const errors = [];

    try {
      try {
        const result = this.audio.setVolume(0);
        console.log(`  ✓ Audio volume set to ${result}%`);
      } catch (err) {
        errors.push({ component: 'audio', error: err.message });
      }

      const tvs = this.config.tvs || [];
      for (const t of tvs) {
        try { this.tv.stopLoop(t); } catch (err) { errors.push({ component: t.id, error: err.message }); }
      }
      const tvResults = await Promise.allSettled(tvs.map(t => this.tv.castStop(t)));
      tvResults.forEach((result, index) => {
        if (result.status === 'rejected' || result.value?.ok === false) {
          errors.push({ component: tvs[index]?.id || `tv-${index + 1}`, error: result.reason?.message || result.value?.error || 'cast stop failed' });
        }
      });

      const projectorResults = await this.projectors.powerOffAll();
      projectorResults.forEach((result, index) => {
        if (result.status === 'rejected' || result.value?.ok === false) {
          const id = this.config.projectors?.[index]?.id || `projector-${index + 1}`;
          errors.push({ component: id, error: result.reason?.message || result.value?.error || 'power-off failed' });
        }
      });

      const plugs = this.config.smartplugs || [];
      if (plugs.length > 0) {
        if (!this.tuya.isConfigured()) {
          errors.push({ component: 'smartplugs', error: 'Tuya credentials unavailable' });
        } else {
          const plugResults = await this.tuya.allOff(plugs);
          errors.push(...plugResults.filter(result => !result.ok).map(result => ({ component: result.id, error: result.error || 'power-off failed' })));
        }
      }

      setTimeout(() => {
        this.projectors.pollAll().then(s => this.broadcast('projectors', s)).catch(() => {});
      }, 5000);

      return errors.length === 0
        ? { ok: true, message: 'Equipment closed' }
        : { ok: false, error: `${errors.length} equipment close action(s) failed`, errors };
    } catch (err) {
      console.error('  ❌ Equipment onClose error:', err.message);
      return { ok: false, error: err.message, errors: [...errors, { component: 'equipment', error: err.message }] };
    }
  },

  getStatus() {
    const projectorStatus = this.projectors.getAllStatus();
    const tvs = this.config.tvs || [];
    const plugs = this.config.smartplugs || [];

    const projectorsOn = projectorStatus.filter(p => p.power === 'on').length;
    const healthy = projectorsOn > 0; // At least one projector is on

    return {
      name: 'equipment',
      healthy,
      details: {
        projectors: {
          total: projectorStatus.length,
          on: projectorsOn,
          off: projectorStatus.filter(p => p.power === 'off').length,
          warming: projectorStatus.filter(p => p.power === 'warming').length,
          cooling: projectorStatus.filter(p => p.power === 'cooling').length,
        },
        tvs: {
          total: tvs.length,
          configured: tvs.filter(t => t.videoUrl).length,
        },
        smartPlugs: {
          total: plugs.length,
          configured: this.tuya.isConfigured(),
        },
        audio: {
          available: true,
        },
      },
    };
  },

  // Cleanup on shutdown
  async shutdown() {
    console.log('  🛑 Equipment cluster shutting down...');
    this.projectors.stopPolling();
    
    // Stop all TV loops
    const tvs = this.config.tvs || [];
    for (const t of tvs) {
      this.tv.stopLoop(t);
    }
  },
};
