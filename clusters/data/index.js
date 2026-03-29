'use strict';

module.exports = {
  name: 'data',
  requires: ['cv'],

  register(app, config, clusters) {
    this.cvLogger = require('./cv-logger');
    this.cvReport = require('./cv-report');
    this.config = config;
  },

  async onOpen() {
    // Data collection starts when CV starts
  },

  async onClose() {
    // Flush any pending writes
  },

  getStatus() {
    return {
      name: this.name,
      healthy: true,
      details: {}
    };
  }
};
