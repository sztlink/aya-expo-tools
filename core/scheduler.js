/**
 * AYA Expo Tools v2 — Scheduler
 *
 * Owns the operational lifecycle for all clusters. Transitions are serialized,
 * adjacent equal requests share one Promise, and partial failures are surfaced as
 * a degraded state instead of being silently treated as success.
 */

'use strict';

const cron = require('node-cron');

const OPEN_ORDER = ['equipment', 'cameras', 'cv', 'data', 'communication'];
const CLOSE_ORDER = [...OPEN_ORDER].reverse();
const DAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

function parseTime(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute, minutes: hour * 60 + minute };
}

function errorMessage(value, fallback) {
  if (value instanceof Error) return value.message;
  if (value && typeof value === 'object') {
    return String(value.error || value.message || fallback);
  }
  return String(value || fallback);
}

class Scheduler {
  constructor(config, clusters, opts = {}) {
    this.config = config || {};
    this.clusters = clusters || {};
    this.addLogEntry = opts.addLogEntry || (() => {});
    this.broadcast = opts.broadcast || (() => {});
    this._cron = opts.cron || cron;
    this._now = typeof opts.now === 'function' ? opts.now : () => new Date();
    this._reconcileOnStart = opts.reconcile !== false;

    this.jobs = [];
    this.enabled = false;
    this.started = false;

    this.state = 'unknown';
    this.isOpen = false; // backward compatibility for existing UI/Portal clients
    this.lastAction = null;
    this.transition = null;
    this.lastTransition = null;
    this.errors = [];
    this.scheduleErrors = [];
    this.manualOverride = null;

    this._queue = [];
    this._activeOperation = null;
    this._operationSequence = 0;
    this._startPromise = null;
    this._bootReconcileStarted = false;
    this._bootReconcilePromise = null;
    this._stopping = false;
    this._stopPromise = null;
    this._pendingRestartPromise = null;
  }

  /**
   * Register cron jobs once and reconcile the boot state once. Repeated calls
   * while started return the original startup Promise and never duplicate jobs.
   * Tests may disable boot reconciliation with constructor/start { reconcile:false }.
   */
  start(opts = {}) {
    if (this._stopping) {
      if (!this._pendingRestartPromise) {
        this._pendingRestartPromise = (this._stopPromise || Promise.resolve()).then(() => {
          this._pendingRestartPromise = null;
          this._stopping = false;
          this._stopPromise = null;
          return this.start(opts);
        });
      }
      return this._pendingRestartPromise;
    }

    if (this.started) {
      return this._startPromise || Promise.resolve({ ok: true, noOp: true, reason: 'already-started' });
    }

    this.started = true;
    this._scheduleJobs();

    const shouldReconcile = opts.reconcile !== undefined
      ? opts.reconcile !== false
      : this._reconcileOnStart;

    if (shouldReconcile && !this._bootReconcileStarted) {
      this._bootReconcileStarted = true;
      this._bootReconcilePromise = this.reconcile(this._now(), { source: 'boot', reason: 'boot-reconcile' });
      this._startPromise = this._bootReconcilePromise;
    } else {
      this._startPromise = Promise.resolve({
        ok: true,
        noOp: true,
        reason: shouldReconcile ? 'boot-already-reconciled' : 'reconcile-disabled',
        state: this.state,
      });
    }

    return this._startPromise;
  }

  _scheduleJobs() {
    this.scheduleErrors = [];
    const schedule = this.config.schedule || {};
    const days = schedule.days;
    const timezone = schedule.timezone || DEFAULT_TIMEZONE;
    let jobCount = 0;

    if (schedule.enabled === false || !days || typeof days !== 'object') {
      this.enabled = false;
      console.log('  📅 Scheduler: no schedule configured');
      return;
    }

    for (const [dayName, times] of Object.entries(days)) {
      if (!times) continue; // null explicitly means closed all day

      const dayNum = DAY_MAP[dayName];
      if (dayNum === undefined) continue;

      for (const action of ['open', 'close']) {
        const parsed = parseTime(times[action]);
        if (!parsed) {
          if (times[action] != null) {
            this.scheduleErrors.push({
              cluster: 'scheduler',
              action,
              day: dayName,
              message: `Invalid schedule time: ${times[action]}`,
              timestamp: new Date().toISOString(),
            });
          }
          continue;
        }

        const openTime = parseTime(times.open);
        const closeTime = parseTime(times.close);
        const cronDay = action === 'close' && openTime && closeTime && openTime.minutes > closeTime.minutes
          ? (dayNum + 1) % 7
          : dayNum;
        const cronExpr = `${parsed.minute} ${parsed.hour} * * ${cronDay}`;
        try {
          const callback = () => {
            const context = { source: 'schedule', reason: `scheduled-${action}`, day: dayName };
            const promise = action === 'open'
              ? this.executeOpen(context)
              : this.executeClose(context);
            promise.catch(err => {
              console.error(`  📅 Scheduled ${action} failed: ${err.message}`);
            });
          };
          const job = this._cron.schedule(cronExpr, callback, {
            timezone,
            recoverMissedExecutions: true,
          });
          this.jobs.push(job);
          jobCount++;
        } catch (err) {
          const detail = {
            cluster: 'scheduler',
            action,
            day: dayName,
            message: err.message,
            timestamp: new Date().toISOString(),
          };
          this.scheduleErrors.push(detail);
          console.error(`  📅 Invalid ${action} schedule for ${dayName}: ${err.message}`);
        }
      }
    }

    this.enabled = jobCount > 0;
    console.log(`  📅 Scheduler: ${jobCount} jobs scheduled (tz: ${timezone})`);
  }

  stop() {
    if (this._stopping && this._stopPromise) return this._stopPromise;
    this._stopping = true;

    for (const job of this.jobs) {
      try { job.stop(); } catch { /* already stopped */ }
    }
    this.jobs = [];
    this.enabled = false;
    this.started = false;
    this._startPromise = null;

    // Queued transitions never started, so resolve them as cancelled. The active
    // transition cannot be interrupted safely mid-cluster; shutdown waits for its
    // completion before stopping the managed resources themselves.
    const cancelledAt = new Date().toISOString();
    for (const operation of this._queue.splice(0)) {
      operation.resolve({
        ok: false,
        cancelled: true,
        action: operation.action,
        targetState: operation.targetState,
        state: this.state,
        noOp: false,
        completedAt: cancelledAt,
        steps: [],
        errors: [{ cluster: 'scheduler', action: operation.action, message: 'Scheduler stopped before transition started', timestamp: cancelledAt }],
        context: operation.context,
      });
    }

    const finish = () => {
      console.log('  📅 Scheduler: stopped');
      return { ok: true, state: this.state };
    };
    this._stopPromise = this._activeOperation
      ? this._activeOperation.promise.then(finish, finish)
      : Promise.resolve(finish());
    return this._stopPromise;
  }

  /**
   * Determine the desired operational state at an instant in schedule.timezone.
   * Opening is inclusive and closing is exclusive. A null day is always closed.
   */
  getDesiredState(now = this._now()) {
    const schedule = this.config.schedule || {};
    const days = schedule.days;
    if (schedule.enabled === false || !days || typeof days !== 'object') return 'closed';

    const zoned = this._getZonedParts(now);
    if (!zoned) return 'closed';

    const today = days[zoned.dayName];
    const minutesNow = zoned.hour * 60 + zoned.minute;

    if (today) {
      const open = parseTime(today.open);
      const close = parseTime(today.close);

      if (open && close) {
        if (open.minutes < close.minutes && minutesNow >= open.minutes && minutesNow < close.minutes) {
          return 'open';
        }
        // Overnight interval: today's late segment.
        if (open.minutes > close.minutes && minutesNow >= open.minutes) {
          return 'open';
        }
      } else if (open && minutesNow >= open.minutes) {
        return 'open';
      } else if (close && minutesNow < close.minutes) {
        return 'open';
      }
    }

    // Explicit null is a hard closed day and overrides an overnight carry-over.
    if (today === null) return 'closed';

    // Overnight interval opened on the previous configured day.
    const previousDay = days[DAY_NAMES[(zoned.dayIndex + 6) % 7]];
    if (previousDay) {
      const previousOpen = parseTime(previousDay.open);
      const previousClose = parseTime(previousDay.close);
      if (previousOpen && previousClose && previousOpen.minutes > previousClose.minutes && minutesNow < previousClose.minutes) {
        return 'open';
      }
    }

    return 'closed';
  }

  _getZonedParts(now) {
    const date = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(date.getTime())) return null;

    const timezone = this.config.schedule?.timezone || DEFAULT_TIMEZONE;
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
      const parts = Object.fromEntries(
        formatter.formatToParts(date)
          .filter(part => part.type !== 'literal')
          .map(part => [part.type, part.value])
      );
      const dayName = String(parts.weekday || '').slice(0, 3).toLowerCase();
      const dayIndex = DAY_MAP[dayName];
      const hour = Number(parts.hour);
      const minute = Number(parts.minute);
      if (dayIndex === undefined || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
      return { dayName, dayIndex, hour, minute };
    } catch (err) {
      console.error(`  📅 Scheduler timezone error (${timezone}): ${err.message}`);
      return null;
    }
  }

  reconcile(now = this._now(), context = {}) {
    const desiredState = this.getDesiredState(now);
    const reconcileContext = { source: 'reconcile', ...context, desiredState };
    return desiredState === 'open'
      ? this.executeOpen(reconcileContext)
      : this.executeClose(reconcileContext);
  }

  // Intentionally not async: callers requesting the same transition receive the
  // exact same Promise object, not an async wrapper around it.
  executeOpen(context = {}) {
    return this._requestTransition('open', context);
  }

  executeClose(context = {}) {
    return this._requestTransition('closed', context);
  }

  _requestTransition(targetState, context) {
    const action = targetState === 'open' ? 'open' : 'close';
    const source = context?.source;
    if (['schedule', 'reconcile', 'boot'].includes(source)) {
      this.manualOverride = null;
    } else if (['manual', 'portal', 'api'].includes(source)) {
      this.manualOverride = {
        state: targetState,
        source,
        actor: context?.actor || null,
        setAt: new Date().toISOString(),
      };
    }
    if (this._stopping) {
      const timestamp = new Date().toISOString();
      return Promise.resolve({
        ok: false,
        cancelled: true,
        action,
        targetState,
        state: this.state,
        noOp: false,
        completedAt: timestamp,
        steps: [],
        errors: [{ cluster: 'scheduler', action, message: 'Scheduler is stopping', timestamp }],
        context: context && typeof context === 'object' ? { ...context } : {},
      });
    }
    const tail = this._queue.length > 0
      ? this._queue[this._queue.length - 1]
      : this._activeOperation;

    // Coalesce only adjacent equal requests. If an opposite request is already
    // queued, a later equal request must remain ordered after it.
    if (tail && tail.targetState === targetState) return tail.promise;

    if (!this._activeOperation && this._queue.length === 0 && this.state === targetState) {
      return Promise.resolve(this._noOpResult(action, targetState));
    }

    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const operation = {
      id: ++this._operationSequence,
      action,
      targetState,
      context: context && typeof context === 'object' ? { ...context } : {},
      requestedAt: new Date().toISOString(),
      promise,
      resolve,
      reject,
    };

    this._queue.push(operation);
    this._drainQueue();
    return promise;
  }

  _drainQueue() {
    if (this._stopping || this._activeOperation || this._queue.length === 0) return;

    const operation = this._queue.shift();
    this._activeOperation = operation;

    void (async () => {
      let result;
      try {
        result = await this._performTransition(operation);
      } catch (err) {
        result = this._catastrophicFailure(operation, err);
      }

      // Clear the completed operation and resolve before draining again so await
      // observes a stable boundary. The opposite queued transition begins in the
      // following microtask, never overlapping the completed work.
      if (this._activeOperation === operation) this._activeOperation = null;
      operation.resolve(result);
      queueMicrotask(() => this._drainQueue());
    })();
  }

  _noOpResult(action, targetState) {
    return {
      ok: true,
      action,
      targetState,
      state: this.state,
      noOp: true,
      message: `Exhibition already ${targetState}`,
      errors: [],
      steps: [],
      completedAt: new Date().toISOString(),
    };
  }

  async _performTransition(operation) {
    const { id, action, targetState, context, requestedAt } = operation;

    // State may have reached the target while this operation waited in the queue.
    if (this.state === targetState) return this._noOpResult(action, targetState);

    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const fromState = this.state;
    const method = action === 'open' ? 'onOpen' : 'onClose';
    const order = action === 'open' ? OPEN_ORDER : CLOSE_ORDER;
    const transitionalState = action === 'open' ? 'opening' : 'closing';

    this.state = transitionalState;
    this.errors = [];
    this.transition = {
      id,
      action,
      targetState,
      fromState,
      state: transitionalState,
      requestedAt,
      startedAt,
      context,
      errors: [],
    };

    console.log(`\n  📅 [${new Date().toLocaleTimeString()}] ${action === 'open' ? 'Opening' : 'Closing'} exhibition...`);
    this._log(`${action}-start`, { transitionId: id, context });
    this._emit(`${action}-start`, { transitionId: id, context });

    const steps = [];
    const failures = [];

    for (const name of order) {
      const cluster = this.clusters[name];
      if (!cluster || typeof cluster[method] !== 'function') {
        steps.push({ cluster: name, ok: true, skipped: true });
        continue;
      }

      try {
        console.log(`  📅   ${name}.${method}()...`);
        const clusterResult = await cluster[method](context);
        if (clusterResult && clusterResult.ok === false) {
          const failure = {
            cluster: name,
            action,
            message: errorMessage(clusterResult, `${name}.${method} returned ok:false`),
            result: clusterResult,
            timestamp: new Date().toISOString(),
          };
          failures.push(failure);
          this.transition.errors.push(failure);
          steps.push({ cluster: name, ok: false, result: clusterResult, error: failure.message });
          this._log(`${action}-${name}-error`, { transitionId: id, error: failure.message });
          console.error(`  📅   ✗ ${name} failed: ${failure.message}`);
          continue;
        }

        steps.push({ cluster: name, ok: true, result: clusterResult });
        this._log(`${action}-${name}-ok`, { transitionId: id });
        console.log(`  📅   ✓ ${name} ${action === 'open' ? 'opened' : 'closed'}`);
      } catch (err) {
        const failure = {
          cluster: name,
          action,
          message: errorMessage(err, `${name}.${method} failed`),
          timestamp: new Date().toISOString(),
        };
        failures.push(failure);
        this.transition.errors.push(failure);
        steps.push({ cluster: name, ok: false, error: failure.message });
        this._log(`${action}-${name}-error`, { transitionId: id, error: failure.message });
        console.error(`  📅   ✗ ${name} failed: ${failure.message}`);
      }
    }

    const completedAt = new Date().toISOString();
    const ok = failures.length === 0;
    this.state = ok ? targetState : 'degraded';
    // In degraded state this preserves the direction most recently applied for
    // legacy clients that only understand isOpen.
    this.isOpen = targetState === 'open';
    this.errors = failures;

    const result = {
      ok,
      action,
      targetState,
      state: this.state,
      noOp: false,
      startedAt,
      completedAt,
      durationMs: Date.now() - startedAtMs,
      steps,
      errors: failures,
      context,
    };

    this.lastAction = {
      type: action,
      timestamp: completedAt,
      ok,
      state: this.state,
      errors: failures,
      context,
    };
    this.lastTransition = {
      ...this.transition,
      state: this.state,
      status: ok ? 'completed' : 'degraded',
      completedAt,
      durationMs: result.durationMs,
      errors: failures,
    };
    this.transition = null;

    const completionAction = ok ? `${action}-complete` : `${action}-degraded`;
    this._log(completionAction, { transitionId: id, errors: failures });
    this._emit(completionAction, { transitionId: id, state: this.state, errors: failures });
    console.log(`  📅 Exhibition ${ok ? targetState : 'degraded'}.\n`);

    return result;
  }

  _catastrophicFailure(operation, err) {
    const failure = {
      cluster: 'scheduler',
      action: operation.action,
      message: errorMessage(err, 'Scheduler transition failed'),
      timestamp: new Date().toISOString(),
    };
    const completedAt = new Date().toISOString();
    this.state = 'degraded';
    this.isOpen = operation.targetState === 'open';
    this.errors = [failure];
    this.lastAction = {
      type: operation.action,
      timestamp: completedAt,
      ok: false,
      state: this.state,
      errors: [failure],
      context: operation.context,
    };
    this.lastTransition = {
      ...(this.transition || {
        id: operation.id,
        action: operation.action,
        targetState: operation.targetState,
        requestedAt: operation.requestedAt,
      }),
      state: 'degraded',
      status: 'failed',
      completedAt,
      errors: [failure],
    };
    this.transition = null;
    this._log(`${operation.action}-failed`, { transitionId: operation.id, error: failure.message });

    return {
      ok: false,
      action: operation.action,
      targetState: operation.targetState,
      state: this.state,
      noOp: false,
      completedAt,
      steps: [],
      errors: [failure],
      context: operation.context,
    };
  }

  _log(message, meta = {}) {
    try { this.addLogEntry(message, 'scheduler', meta); } catch { /* logging must not break lifecycle */ }
  }

  _emit(action, data = {}) {
    try {
      this.broadcast('scheduler', { action, timestamp: Date.now(), ...data });
    } catch { /* telemetry must not break lifecycle */ }
  }

  getStatus(now = this._now()) {
    const schedule = this.config.schedule || {};
    const zoned = this._getZonedParts(now);
    const todayName = zoned?.dayName || null;
    const todaySchedule = todayName && schedule.days ? (schedule.days[todayName] ?? null) : null;

    const scheduledDesiredState = this.getDesiredState(now);
    return {
      isOpen: this.isOpen,
      state: this.state,
      actualState: this.state,
      desiredState: this.manualOverride?.state || scheduledDesiredState,
      scheduledDesiredState,
      manualOverride: this.manualOverride ? { ...this.manualOverride } : null,
      transition: this.transition ? {
        ...this.transition,
        errors: [...(this.transition.errors || [])],
      } : null,
      lastTransition: this.lastTransition ? {
        ...this.lastTransition,
        errors: [...(this.lastTransition.errors || [])],
      } : null,
      errors: [...this.scheduleErrors, ...this.errors],
      scheduleErrors: [...this.scheduleErrors],
      pendingTransitions: this._queue.map(op => ({
        id: op.id,
        action: op.action,
        targetState: op.targetState,
        requestedAt: op.requestedAt,
      })),
      lastAction: this.lastAction,
      today: todayName,
      todaySchedule,
      timezone: schedule.timezone || DEFAULT_TIMEZONE,
      schedule: schedule.days || {},
      jobCount: this.jobs.length,
      enabled: this.enabled,
      started: this.started,
      bootReconciled: this._bootReconcileStarted,
    };
  }
}

module.exports = { Scheduler };
