/**
 * AYA Expo Tools v2 — Scheduler
 *
 * Orchestrates all clusters via their onOpen()/onClose() contract.
 *
 * Config:
 *   schedule.days: { mon: { open: "09:00", close: "20:00" }, tue: null, ... }
 *   schedule.timezone: "America/Sao_Paulo"
 *
 * Open sequence:  equipment → cameras → cv → communication
 * Close sequence: communication → cv → cameras → equipment
 *
 * Each step is try/catch — failure in one cluster doesn't block the rest.
 */

'use strict';

const cron = require('node-cron');

const OPEN_ORDER = ['equipment', 'cameras', 'cv', 'data', 'communication'];
const CLOSE_ORDER = [...OPEN_ORDER].reverse();

const DAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

class Scheduler {
  constructor(config, clusters, opts = {}) {
    this.config = config;
    this.clusters = clusters;
    this.addLogEntry = opts.addLogEntry || (() => {});
    this.broadcast = opts.broadcast || (() => {});
    this.jobs = [];
    this.isOpen = false;
    this.lastAction = null;
  }

  start() {
    const sched = this.config.schedule;
    if (!sched || !sched.days) {
      console.log('  📅 Scheduler: no schedule configured');
      return;
    }

    const tz = sched.timezone || 'America/Sao_Paulo';
    const days = sched.days;
    let jobCount = 0;

    for (const [dayName, times] of Object.entries(days)) {
      if (!times) continue; // null = closed day

      const dayNum = DAY_MAP[dayName];
      if (dayNum === undefined) continue;

      if (times.open) {
        const [h, m] = times.open.split(':').map(Number);
        const cronExpr = `${m} ${h} * * ${dayNum}`;
        const job = cron.schedule(cronExpr, () => this.executeOpen(), { timezone: tz, recoverMissedExecutions: true });
        this.jobs.push(job);
        jobCount++;
      }

      if (times.close) {
        const [h, m] = times.close.split(':').map(Number);
        const cronExpr = `${m} ${h} * * ${dayNum}`;
        const job = cron.schedule(cronExpr, () => this.executeClose(), { timezone: tz, recoverMissedExecutions: true });
        this.jobs.push(job);
        jobCount++;
      }
    }

    this.enabled = jobCount > 0;
    console.log(`  📅 Scheduler: ${jobCount} jobs scheduled (tz: ${tz})`);
  }

  stop() {
    this.jobs.forEach(j => j.stop());
    this.jobs = [];
    console.log('  📅 Scheduler: stopped');
  }

  async executeOpen() {
    console.log(`\n  📅 [${new Date().toLocaleTimeString()}] Opening exhibition...`);
    this.addLogEntry('scheduler', 'open-start');
    this.broadcast({ type: 'scheduler', action: 'open-start', timestamp: Date.now() });

    for (const name of OPEN_ORDER) {
      const cluster = this.clusters[name];
      if (!cluster) continue;

      try {
        console.log(`  📅   ${name}.onOpen()...`);
        await cluster.onOpen();
        console.log(`  📅   ✓ ${name} opened`);
        this.addLogEntry('scheduler', `open-${name}-ok`);
      } catch (err) {
        console.error(`  📅   ✗ ${name} failed: ${err.message}`);
        this.addLogEntry('scheduler', `open-${name}-error`, { error: err.message });
      }
    }

    this.isOpen = true;
    this.lastAction = { type: 'open', timestamp: new Date().toISOString() };
    this.addLogEntry('scheduler', 'open-complete');
    this.broadcast({ type: 'scheduler', action: 'open-complete', timestamp: Date.now() });
    console.log('  📅 Exhibition opened.\n');
  }

  async executeClose() {
    console.log(`\n  📅 [${new Date().toLocaleTimeString()}] Closing exhibition...`);
    this.addLogEntry('scheduler', 'close-start');
    this.broadcast({ type: 'scheduler', action: 'close-start', timestamp: Date.now() });

    for (const name of CLOSE_ORDER) {
      const cluster = this.clusters[name];
      if (!cluster) continue;

      try {
        console.log(`  📅   ${name}.onClose()...`);
        await cluster.onClose();
        console.log(`  📅   ✓ ${name} closed`);
        this.addLogEntry('scheduler', `close-${name}-ok`);
      } catch (err) {
        console.error(`  📅   ✗ ${name} failed: ${err.message}`);
        this.addLogEntry('scheduler', `close-${name}-error`, { error: err.message });
      }
    }

    this.isOpen = false;
    this.lastAction = { type: 'close', timestamp: new Date().toISOString() };
    this.addLogEntry('scheduler', 'close-complete');
    this.broadcast({ type: 'scheduler', action: 'close-complete', timestamp: Date.now() });
    console.log('  📅 Exhibition closed.\n');
  }

  getStatus() {
    const sched = this.config.schedule || {};
    const now = new Date();
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const todayName = dayNames[now.getDay()];
    const todaySchedule = sched.days ? sched.days[todayName] : null;

    return {
      isOpen: this.isOpen,
      lastAction: this.lastAction,
      today: todayName,
      todaySchedule,
      timezone: sched.timezone || 'America/Sao_Paulo',
      schedule: sched.days || {},
      jobCount: this.jobs.length
    };
  }
}

module.exports = { Scheduler };
