'use strict';

const PortalSync = require('./portal-sync');

module.exports = {
  name: 'communication',
  requires: ['equipment', 'cameras', 'cv'],

  register(app, config, clusters) {
    this.config = config;
    // PortalSync receives dependencies from other clusters via register
    // In v1 it took 8 constructor args — now mapped from clusters{}
    if (config.modules?.portal?.enabled !== false) {
      this.portalSync = new PortalSync(
        config,
        clusters.equipment?.projectors || null,
        clusters.cameras?.cameras || null,
        null, // scheduler — will be passed from core
        null, // readLog
        null, // session
        clusters.cv?.cvManager || null,
        null  // serverHealth
      );
    }
  },

  async onOpen() {
    if (this.portalSync) this.portalSync.start();
  },

  async onClose() {
    if (this.portalSync) this.portalSync.stop();
  },

  getStatus() {
    return {
      name: this.name,
      healthy: true,
      details: {
        portalSync: this.portalSync ? 'active' : 'disabled'
      }
    };
  }
};
