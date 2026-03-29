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

    // Start polling
    const pollInterval = config.pjlink?.pollInterval || 30000;
    this.projectors.startPolling(pollInterval);

    console.log(`  ✓ Equipment cluster loaded (${config.projectors?.length || 0} projectors, ${config.tvs?.length || 0} TVs)`);
  },

  async onOpen() {
    console.log('  🟢 Equipment: Opening...');
    
    try {
      // Power on all projectors
      await this.projectors.powerOnAll();
      console.log('  ✓ Projectors powered on');

      // Power on smart plugs if configured
      const plugs = this.config.smartplugs || [];
      if (plugs.length > 0 && this.tuya.isConfigured()) {
        await this.tuya.allOn(plugs);
        console.log(`  ✓ ${plugs.length} smart plugs powered on`);
      }

      // Power on TVs via WOL
      const tvs = this.config.tvs || [];
      if (tvs.length > 0) {
        await Promise.allSettled(tvs.map(t => this.tv.powerOn(t)));
        console.log(`  ✓ ${tvs.length} TVs wake-on-LAN sent`);
      }

      // Wait for equipment to warm up, then poll
      setTimeout(() => {
        this.projectors.pollAll().then(s => this.broadcast('projectors', s));
      }, 5000);

      return { ok: true, message: 'Equipment opened' };
    } catch (err) {
      console.error('  ❌ Equipment onOpen error:', err.message);
      return { ok: false, error: err.message };
    }
  },

  async onClose() {
    console.log('  🔴 Equipment: Closing...');
    
    try {
      // Stop all TV loops
      const tvs = this.config.tvs || [];
      for (const t of tvs) {
        this.tv.stopLoop(t);
      }

      // Stop casting on all TVs
      await Promise.allSettled(tvs.map(t => this.tv.castStop(t)));
      console.log(`  ✓ ${tvs.length} TVs stopped`);

      // Power off all projectors
      await this.projectors.powerOffAll();
      console.log('  ✓ Projectors powered off');

      // Power off smart plugs if configured
      const plugs = this.config.smartplugs || [];
      if (plugs.length > 0 && this.tuya.isConfigured()) {
        await this.tuya.allOff(plugs);
        console.log(`  ✓ ${plugs.length} smart plugs powered off`);
      }

      // Poll projectors after shutdown
      setTimeout(() => {
        this.projectors.pollAll().then(s => this.broadcast('projectors', s));
      }, 5000);

      return { ok: true, message: 'Equipment closed' };
    } catch (err) {
      console.error('  ❌ Equipment onClose error:', err.message);
      return { ok: false, error: err.message };
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
