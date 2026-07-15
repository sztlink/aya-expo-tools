'use strict';

const { PortalSync } = require('./portal-sync');

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
    if (!this.portalSync) return { ok: true, skipped: true, message: 'Portal Sync disabled' };
    return this.portalSync.start();
  },

  async onClose() {
    // Portal Sync is always-on. Its internal schedule-aware interval reduces the
    // heartbeat rate outside opening hours, but it must never stop on close.
    return { ok: true, noOp: true, message: 'Portal Sync remains active off-hours' };
  },

  getStatus() {
    return {
      name: this.name,
      healthy: true,
      details: {
        portalSync: this.portalSync ? 'active' : 'disabled',
        portalSyncStatus: this.portalSync ? this.portalSync.getStatus() : null
      }
    };
  }
};
