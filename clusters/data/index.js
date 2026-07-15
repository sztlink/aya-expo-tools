'use strict';

const cron = require('node-cron');

module.exports = {
  name: 'data',
  requires: ['cv'],

  register(app, config, clusters) {
    this.cvLogger = require('./cv-logger');
    this.cvReport = require('./cv-report');
    this.reportGenerator = require('./report-generator');
    this.cvManager = clusters.cv?.cvManager || null;
    this.config = config;
    this.cronJobs = [];
    this._started = false;
    this._loggerActive = false;
  },

  /** Always-on report scheduling. CV sampling remains owned by onOpen/onClose. */
  start() {
    if (this._started) {
      return { ok: true, noOp: true, message: 'Data report schedules already running' };
    }

    this._started = true;
    const timezone = this.config.schedule?.timezone || 'America/Sao_Paulo';

    try {
      // Schedule daily report (default 07:00), including closed hours.
      const dailyTime = this.config.reports?.daily?.time || '07:00';
      const [dailyHour, dailyMinute] = dailyTime.split(':');
      const dailyCron = `${dailyMinute} ${dailyHour} * * *`;
      const dailyJob = cron.schedule(dailyCron, async () => {
        console.log('[Data] Generating daily report...');
        try {
          await this.reportGenerator.generateDailyReport(this.config);
        } catch (err) {
          console.error(`[Data] Daily report failed: ${err.message}`);
        }
      }, { timezone });
      this.cronJobs.push(dailyJob);
      console.log(`[Data] Daily report scheduled at ${dailyTime}`);

      // Schedule weekly report (default Monday 20:30).
      const weeklyDay = this.config.reports?.weekly?.day ?? 1; // 0=Sunday
      const weeklyTime = this.config.reports?.weekly?.time || '20:30';
      const [weeklyHour, weeklyMinute] = weeklyTime.split(':');
      const weeklyCron = `${weeklyMinute} ${weeklyHour} * * ${weeklyDay}`;
      const weeklyJob = cron.schedule(weeklyCron, async () => {
        console.log('[Data] Generating weekly report...');
        try {
          await this.reportGenerator.generateWeeklyReport(this.config);
        } catch (err) {
          console.error(`[Data] Weekly report failed: ${err.message}`);
        }
      }, { timezone });
      this.cronJobs.push(weeklyJob);
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weeklyDay] || weeklyDay;
      console.log(`[Data] Weekly report scheduled for ${dayName} at ${weeklyTime}`);

      return { ok: true, message: 'Data report schedules started', jobs: this.cronJobs.length };
    } catch (err) {
      for (const job of this.cronJobs) {
        try { job.stop(); } catch { /* ignore */ }
      }
      this.cronJobs = [];
      this._started = false;
      return { ok: false, error: err.message };
    }
  },

  async onOpen() {
    if (!this.cvLogger || !this.cvManager) {
      return { ok: false, error: 'CV logger dependencies unavailable' };
    }
    if (this._loggerActive || this.cvLogger.isRunning?.()) {
      this._loggerActive = true;
      return { ok: true, noOp: true, message: 'CV logger already running' };
    }

    const result = await this.cvLogger.start(this.cvManager);
    if (result && result.ok === false) return result;
    this._loggerActive = true;
    return result || { ok: true, message: 'CV logger started' };
  },

  async onClose() {
    const running = this._loggerActive || this.cvLogger?.isRunning?.();
    if (!running) return { ok: true, noOp: true, message: 'CV logger already stopped' };

    const result = await this.cvLogger.stop();
    if (result && result.ok === false) return result;
    this._loggerActive = false;
    return result || { ok: true, message: 'CV logger stopped' };
  },

  stop() {
    for (const job of this.cronJobs) {
      try { job.stop(); } catch { /* already stopped */ }
    }
    this.cronJobs = [];
    this._started = false;

    if (this._loggerActive || this.cvLogger?.isRunning?.()) {
      this.cvLogger.stop();
    }
    this._loggerActive = false;
    return { ok: true, message: 'Data cluster stopped' };
  },

  getStatus() {
    return {
      name: this.name,
      healthy: true,
      details: {
        cronJobs: this.cronJobs.length,
        reportsScheduled: this._started,
        cvLoggerRunning: this._loggerActive || !!this.cvLogger?.isRunning?.(),
      }
    };
  }
};
