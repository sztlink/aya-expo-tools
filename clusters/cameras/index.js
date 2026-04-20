'use strict';

const { CameraManager } = require('./cameras');
const { TimelapseCapture } = require('./timelapse');

module.exports = {
  name: 'cameras',
  requires: [],

  register(app, config, clusters) {
    this.cameras = new CameraManager(config);
    this.timelapse = new TimelapseCapture(this.cameras);
    this.config = config;
    require('./routes')(app, this);
  },

  async onOpen() {
    // Timelapse start handled by scheduler
  },

  async onClose() {
    // Timelapse stop
  },

  getStatus() {
    return {
      name: this.name,
      healthy: true,
      details: {
        cameras: this.cameras ? this.cameras.getAllStatus() : null
      }
    };
  }
};
