'use strict';

const cron = require('node-cron');

module.exports = {
  name: 'data',
  requires: ['cv'],

  register(app, config, clusters) {
    this.cvLogger = require('./cv-logger');
    this.cvReport = require('./cv-report');
    this.reportGenerator = require('./report-generator');
    this.config = config;
    this.cronJobs = [];
  },

  async onOpen() {
    // Data collection starts when CV starts
    
    // Schedule daily report at 07:00
    const dailyTime = this.config.reports?.daily?.time || '07:00';
    const [dailyHour, dailyMinute] = dailyTime.split(':');
    const dailyCron = `${dailyMinute} ${dailyHour} * * *`;
    
    const dailyJob = cron.schedule(dailyCron, async () => {
      console.log('[Data] Generating daily report...');
      await this.reportGenerator.generateDailyReport(this.config);
    });
    
    this.cronJobs.push(dailyJob);
    console.log(`[Data] Daily report scheduled at ${dailyTime}`);

    // Schedule weekly report (default: Monday 20:30)
    const weeklyDay = this.config.reports?.weekly?.day || 1; // 0=Sunday, 1=Monday
    const weeklyTime = this.config.reports?.weekly?.time || '20:30';
    const [weeklyHour, weeklyMinute] = weeklyTime.split(':');
    const weeklyCron = `${weeklyMinute} ${weeklyHour} * * ${weeklyDay}`;
    
    const weeklyJob = cron.schedule(weeklyCron, async () => {
      console.log('[Data] Generating weekly report...');
      await this.reportGenerator.generateWeeklyReport(this.config);
    });
    
    this.cronJobs.push(weeklyJob);
    console.log(`[Data] Weekly report scheduled for ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weeklyDay]} at ${weeklyTime}`);
  },

  async onClose() {
    // Stop cron jobs
    for (const job of this.cronJobs) {
      job.stop();
    }
    this.cronJobs = [];
    
    // Flush any pending writes
  },

  getStatus() {
    return {
      name: this.name,
      healthy: true,
      details: {
        cronJobs: this.cronJobs.length,
        reportsScheduled: true
      }
    };
  }
};
