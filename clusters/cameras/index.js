'use strict';

const { CameraManager } = require('./cameras');
const { TimelapseCapture } = require('./timelapse');

module.exports = {
  name: 'cameras',
  requires: [],

  register(app, config, clusters) {
    this.cameras = new CameraManager(config);
    this.timelapse = new TimelapseCapture(this.cameras, {
      timezone: config.schedule?.timezone || 'America/Sao_Paulo',
    });
    this._timelapseActive = false;
    this.config = config;
    require('./routes')(app, this);
  },

  async onOpen() {
    if (!this.timelapse) return { ok: true, skipped: true, message: 'Timelapse unavailable' };
    const running = this._timelapseActive || this.timelapse.getStats?.().running;
    if (running) return { ok: true, noOp: true, message: 'Timelapse already running' };

    const result = await this.timelapse.start();
    if (result && result.ok === false) return result;
    this._timelapseActive = true;
    return { ok: true, message: 'Timelapse started' };
  },

  async onClose() {
    if (!this.timelapse) return { ok: true, skipped: true, message: 'Timelapse unavailable' };
    const running = this._timelapseActive || this.timelapse.getStats?.().running;
    if (!running) return { ok: true, noOp: true, message: 'Timelapse already stopped' };

    const result = await this.timelapse.stop();
    if (result && result.ok === false) return result;
    this._timelapseActive = false;
    return { ok: true, message: 'Timelapse stopped' };
  },

  getStatus() {
    return {
      name: this.name,
      healthy: true,
      details: {
        cameras: this.cameras ? this.cameras.getAllStatus() : null,
        timelapse: this.timelapse?.getStats ? this.timelapse.getStats() : null
      }
    };
  }
};
