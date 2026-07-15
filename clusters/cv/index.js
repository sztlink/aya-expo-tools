'use strict';

const { CVManager } = require('./cv-manager');

module.exports = {
  name: 'cv',
  requires: ['cameras'],

  register(app, config, clusters) {
    this.cvManager = new CVManager(config);
    this.config = config;
    require('./routes')(app, this);
  },

  async onOpen() {
    if (!this.cvManager) return { ok: true, skipped: true, message: 'CV unavailable' };
    return this.cvManager.start();
  },

  async onClose() {
    if (!this.cvManager) return { ok: true, skipped: true, message: 'CV unavailable' };
    return this.cvManager.stop();
  },

  getStatus() {
    return {
      name: this.name,
      healthy: !!(this.cvManager),
      details: this.cvManager ? this.cvManager.getStatus() : {}
    };
  }
};
