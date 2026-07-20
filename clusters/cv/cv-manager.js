/**
 * AYA Expo Tools — Computer Vision Manager v2
 *
 * v2: protocolo JSONL stdout (zero latência) em vez de polling de arquivo.
 *     Python emite eventos linha a linha; Node lê e processa em tempo real.
 *     Arquivos (heatmap.png, frame.jpg) ainda servidos como static.
 *
 * API pública (inalterada):
 *   cvManager.start()
 *   cvManager.stop()
 *   cvManager.getStatus()           → { enabled, running, totalCount, perCamera, zones, ... }
 *   cvManager.getDetections(camId)  → { count, detections, zones, fps, timestamp }
 *   cvManager.getHeatmap(camId)     → Buffer (PNG) | null
 *   cvManager.getFrame(camId)       → Buffer (JPEG) | null
 *   cvManager.resetHeatmap(camId)
 *   cvManager.getCounterData()
 *   cvManager.getCounterFrame()
 *
 * Eventos Node.js emitidos:
 *   cvManager.on('detection', { camId, count, fps, zones, detections, timestamp })
 *   cvManager.on('zone_change', { camId, zoneId, count, previous, timestamp }) [futuro]
 *   cvManager.on('ready', { camId, model, format, gpuName, zones })
 *   cvManager.on('error', { camId, message, retriable })
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

const CV_DIR = path.join(__dirname, 'python');
const OUTPUT_DIR = path.join(CV_DIR, 'output');

class CVManager extends EventEmitter {
  constructor(config, opts = {}) {
    super();
    // EventEmitter: sem listener para 'error' → uncaught exception. Handler padrão.
    this.on('error', (err) => {
      console.error(`  👁️ CV [${err?.camId || '?'}] erro: ${err?.message || err}`);
    });
    this.config = config;
    this.cvConfig = config.cv || {};
    this.camerasConfig = config.cameras || [];
    this.enabled = !!this.cvConfig.enabled;

    this.processes = new Map();   // camId → { process, pid, camId }
    this.reidProcesses = new Map(); // camId → { process, pid, camId } for ReID
    this.counterProcess = null;        // single mode
    this.counterProcesses = new Map(); // dual mode: 'entry'|'exit' → { process, pid }
    this._buffers = new Map();    // camId → string (linha parcial)
    this._reidBuffers = new Map(); // camId → string (linha parcial ReID)
    this._cache = new Map();      // camId → último evento 'detection' recebido
    this._reidCache = new Map();   // camId → último evento ReID
    this._readyInfo = new Map();  // camId → detector ready event
    this._reidReady = new Set();  // camId → ReID ready event observed
    this._configPath = null;      // definido no start()

    // Lifecycle generation prevents stale exit/restart callbacks from a previous
    // stop() from mutating or recreating the current process set.
    this._active = false;
    this._generation = 0;
    this._restartTimers = new Map(); // unit key → timeout
    this._stoppingPromise = null;
    this._pendingStartPromise = null;
    this._restartPromise = null;
    this._maintenanceRestart = null;
    this._spawn = opts.spawn || spawn;
    this._setTimeout = opts.setTimeout || setTimeout;
    this._clearTimeout = opts.clearTimeout || clearTimeout;
    this._platform = opts.platform || process.platform;
    this._treeKill = opts.treeKill || ((pid) => {
      if (this._platform !== 'win32') return;
      const { execSync } = require('child_process');
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore', timeout: 5000 });
    });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  start() {
    if (this._stoppingPromise) {
      if (!this._pendingStartPromise) {
        this._pendingStartPromise = this._stoppingPromise.then(() => {
          this._pendingStartPromise = null;
          return this.start();
        });
      }
      return this._pendingStartPromise;
    }

    const configured = this.cvConfig?.enabled !== false;
    this.enabled = configured;
    if (!configured) {
      console.log('  👁️ CV: desativado (cv.enabled = false no config)');
      return { ok: true, skipped: true, message: 'CV disabled' };
    }

    if (!this._active) {
      this._active = true;
      this._generation++;
      this._cancelRestartTimers();
    }
    const generation = this._generation;
    const cvCameras = [...new Set(
      (this.cvConfig.cameras || [this.cvConfig.camera || 'cam-1']).filter(Boolean)
    )];
    const reidEnabled = !!this.cvConfig.reid?.enabled;
    const counterCfg = this.cvConfig.counter;

    const missingDetectors = cvCameras.filter(camId => !this.processes.has(camId));
    const missingReid = reidEnabled
      ? cvCameras.filter(camId => !this.reidProcesses.has(camId))
      : [];
    const missingCounters = [];
    if (counterCfg?.enabled) {
      if (counterCfg.mode === 'dual') {
        if (!this.counterProcesses.has('entry')) missingCounters.push('entry');
        if (!this.counterProcesses.has('exit')) missingCounters.push('exit');
      } else if (!this.counterProcess) {
        missingCounters.push('single');
      }
    }

    // Fully populated generation: avoid even the Python discovery subprocess.
    if (missingDetectors.length === 0 && missingReid.length === 0 && missingCounters.length === 0) {
      return {
        ok: true,
        noOp: true,
        message: 'CV already running',
        generation,
        detectors: this.processes.size,
        reid: this.reidProcesses.size,
        counters: this.counterProcesses.size + (this.counterProcess ? 1 : 0),
      };
    }

    const pythonCmd = this._findPython();
    if (!pythonCmd) {
      console.log('  👁️ CV: Python não encontrado — execute install.bat');
      return { ok: false, error: 'Python not found', generation };
    }

    this._configPath = this._getConfigPath();
    try {
      if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    } catch (err) {
      return { ok: false, error: `CV output directory unavailable: ${err.message}`, generation };
    }

    const startErrors = [];
    const attempt = (unit, fn) => {
      try { fn(); } catch (err) { startErrors.push({ unit, message: err.message }); }
    };

    if (missingDetectors.length > 0) {
      console.log(`  👁️ CV v2: iniciando ${missingDetectors.length} detector(es) | JSONL protocol`);
      for (const camId of missingDetectors) {
        attempt(`detector:${camId}`, () => this._startDetector(camId, pythonCmd, this._configPath, generation));
      }
    }

    if (missingReid.length > 0) {
      console.log(`  🔍 ReID: iniciando ${missingReid.length} processo(s)`);
      for (const camId of missingReid) {
        attempt(`reid:${camId}`, () => this._startReid(camId, pythonCmd, this._configPath, generation));
      }
    }

    if (counterCfg?.enabled) {
      if (counterCfg.mode === 'dual') {
        if (missingCounters.includes('entry')) {
          attempt('counter:entry', () => this._startCounterInstance(pythonCmd, this._configPath, counterCfg.entry || {}, 'entry', generation));
        }
        if (missingCounters.includes('exit')) {
          attempt('counter:exit', () => this._startCounterInstance(pythonCmd, this._configPath, counterCfg.exit || {}, 'exit', generation));
        }
      } else if (missingCounters.includes('single')) {
        attempt('counter:single', () => this._startCounter(pythonCmd, this._configPath, counterCfg, generation));
      }
    }

    for (const camId of cvCameras) {
      if (!this.processes.has(camId)) startErrors.push({ unit: `detector:${camId}`, message: 'Detector did not start' });
      if (reidEnabled && !this.reidProcesses.has(camId)) startErrors.push({ unit: `reid:${camId}`, message: 'ReID did not start' });
    }
    if (counterCfg?.enabled) {
      if (counterCfg.mode === 'dual') {
        for (const role of ['entry', 'exit']) {
          if (!this.counterProcesses.has(role)) startErrors.push({ unit: `counter:${role}`, message: 'Counter did not start' });
        }
      } else if (!this.counterProcess) {
        startErrors.push({ unit: 'counter:single', message: 'Counter did not start' });
      }
    }

    return {
      ok: startErrors.length === 0,
      error: startErrors.length > 0 ? startErrors.map(item => `${item.unit}: ${item.message}`).join('; ') : undefined,
      errors: startErrors,
      generation,
      detectors: this.processes.size,
      reid: this.reidProcesses.size,
      counters: this.counterProcesses.size + (this.counterProcess ? 1 : 0),
    };
  }

  stop(options = {}) {
    // A scheduler close/shutdown always wins over an in-flight maintenance
    // restart. The restart's own stop is the only call that preserves its token.
    if (!options.forRestart && this._maintenanceRestart) {
      this._maintenanceRestart.cancelled = true;
    }
    if (this._stoppingPromise) return this._stoppingPromise;

    const hadRuntime = this._active
      || this.processes.size > 0
      || this.reidProcesses.size > 0
      || this.counterProcesses.size > 0
      || !!this.counterProcess
      || this._restartTimers.size > 0;

    this.enabled = false;
    this._active = false;
    this._generation++;
    const stoppedGeneration = this._generation;
    this._cancelRestartTimers();

    const processEntries = [...this.processes.values()];
    const reidEntries = [...this.reidProcesses.values()];
    const counterEntries = [...this.counterProcesses.values()];
    const singleCounter = this.counterProcess;
    const allEntries = [...processEntries, ...reidEntries, ...counterEntries];
    if (singleCounter) allEntries.push(singleCounter);

    // Ownership is cleared now, but start() is gated by _stoppingPromise until
    // every old child exits (or the targeted force-kill timeout is reached).
    this.processes.clear();
    this.reidProcesses.clear();
    this.counterProcesses.clear();
    this.counterProcess = null;
    this._buffers.clear();
    this._reidBuffers.clear();
    this._cache.clear();
    this._readyInfo.clear();
    this._reidReady.clear();
    this._reidCache.clear();

    const result = hadRuntime
      ? { ok: true, message: 'CV stopped', generation: stoppedGeneration }
      : { ok: true, noOp: true, message: 'CV already stopped', generation: stoppedGeneration };
    const processObjects = [...new Set(allEntries.map(entry => entry?.process).filter(Boolean))];
    if (processObjects.length === 0) return Promise.resolve(result);

    let resolveStop;
    const stoppingPromise = new Promise(resolve => { resolveStop = resolve; });
    this._stoppingPromise = stoppingPromise;
    const remaining = new Set(processObjects);
    const cleanupListeners = [];
    let killTimer = null;
    let finished = false;

    const finish = (forced = false) => {
      if (finished) return;
      finished = true;
      if (killTimer !== null && killTimer !== undefined) this._clearTimeout(killTimer);
      for (const cleanup of cleanupListeners) cleanup();
      if (this._stoppingPromise === stoppingPromise) this._stoppingPromise = null;
      resolveStop(forced ? { ...result, forced: true } : result);
    };

    const markExited = proc => {
      remaining.delete(proc);
      if (remaining.size === 0) finish(false);
    };

    for (const proc of processObjects) {
      const onDone = () => markExited(proc);
      if (typeof proc.once === 'function') {
        proc.once('exit', onDone);
        proc.once('close', onDone);
        cleanupListeners.push(() => {
          try { proc.removeListener('exit', onDone); } catch {}
          try { proc.removeListener('close', onDone); } catch {}
        });
      }
      if (proc.exitCode !== null && proc.exitCode !== undefined) markExited(proc);
    }
    if (finished) return stoppingPromise;

    const pids = [...new Set(allEntries.map(entry => entry?.pid).filter(pid => pid != null))];
    killTimer = this._setTimeout(() => {
      for (const proc of remaining) {
        try { proc.kill('SIGKILL'); } catch {}
      }

      // Target only captured old trees and never a PID already owned by a
      // current generation (defensive against PID reuse).
      const currentPids = new Set([
        ...this.processes.values(),
        ...this.reidProcesses.values(),
        ...this.counterProcesses.values(),
        ...(this.counterProcess ? [this.counterProcess] : []),
      ].map(entry => entry?.pid).filter(pid => pid != null));
      for (const pid of pids) {
        if (currentPids.has(pid)) continue;
        try { this._treeKill(pid); } catch { /* process may already be dead */ }
      }
      finish(true);
    }, 5000);
    if (killTimer?.unref) killTimer.unref();

    // On Windows the venv launcher must still be alive when taskkill /T captures
    // its descendants. Killing the launcher first can orphan python.exe.
    if (this._platform === 'win32') {
      for (const pid of pids) {
        try { this._treeKill(pid); } catch { /* process may already be gone */ }
      }
      finish(true);
      return stoppingPromise;
    }

    // POSIX path: graceful signal first, force-kill only after the timeout.
    for (const entry of processEntries) {
      console.log(`  👁️ CV [${entry.camId}]: parando (PID ${entry.pid})...`);
      try { entry.process.kill('SIGTERM'); } catch {}
    }
    for (const entry of reidEntries) {
      console.log(`  🔍 ReID [${entry.camId}]: parando (PID ${entry.pid})...`);
      try { entry.process.kill('SIGTERM'); } catch {}
    }
    for (const entry of counterEntries) {
      try { entry.process.kill('SIGTERM'); } catch {}
    }
    if (singleCounter) {
      try { singleCounter.process.kill('SIGTERM'); } catch {}
    }

    return stoppingPromise;
  }

  restart(shouldStart = () => true) {
    if (this._restartPromise) return this._restartPromise;
    const token = { cancelled: false };
    this._maintenanceRestart = token;
    this._restartPromise = (async () => {
      await this.stop({ forRestart: true });
      if (token.cancelled || !shouldStart()) {
        return { ok: false, cancelled: true, error: 'CV restart cancelled by scheduler transition' };
      }
      return this.start();
    })().finally(() => {
      if (this._maintenanceRestart === token) this._maintenanceRestart = null;
      this._restartPromise = null;
    });
    return this._restartPromise;
  }

  reload(config) {
    this.config = config;
    this.cvConfig = config.cv || {};
    this.camerasConfig = config.cameras || [];
    // Para aplicar mudanças: chamar stop() seguido de start().
  }

  /**
   * Status agregado — shape mantido compatível com portal-sync e API REST.
   */
  getStatus() {
    const cvCameras = this.cvConfig.cameras || [this.cvConfig.camera || 'cam-1'];
    const strategy = this.cvConfig.countStrategy || 'max';
    const perCamera = {};
    const counts = [];
    const expectedDetectorCount = cvCameras.length;
    const expectedReidCount = this.cvConfig.reid?.enabled ? cvCameras.length : 0;
    const expectedCounterCount = this.cvConfig.counter?.enabled
      ? (this.cvConfig.counter.mode === 'dual' ? 2 : 1)
      : 0;

    for (const camId of cvCameras) {
      const cached = this._cache.get(camId);
      const readyInfo = this._readyInfo.get(camId) || {};
      const count = cached?.count ?? 0;
      counts.push(count);

      perCamera[camId] = {
        count,
        fps: cached?.fps ?? 0,
        running: this.processes.has(camId),
        pid: this.processes.get(camId)?.pid || null,
        model: readyInfo.model || this.cvConfig.detectorModel || this.cvConfig.model || 'yolo11n',
        format: readyInfo.format || 'unknown',
        gpuName: readyInfo.gpuName || null,
        zones: cached?.zones || {},
        dwell: cached?.dwell || {},
        activeVisitors: cached?.activeVisitors || {},
        timestamp: cached?.timestamp || null,
      };
    }

    // Agrega zonas respeitando strategy por zona:
    //   "max"   → heurística conservadora para câmeras no mesmo espaço físico
    //   "sum"   → soma zonas distintas sem sobreposição
    //   "single"→ uma câmera domina a zona
    //   "fused" → deduplicação geométrica entre 2 câmeras calibradas (MVP)
    const zonesConfig = this.cvConfig.zones || [];
    const aggregatedZones = {};
    const fusionZones = {};

    for (const zone of zonesConfig) {
      const zoneStrategy = zone.strategy || 'max';
      const cameras = zone.cameras || {};
      const zoneCamIds = Array.isArray(cameras) ? cameras : Object.keys(cameras);
      const values = zoneCamIds
        .map(cid => perCamera[cid]?.zones?.[zone.id])
        .filter(v => v !== undefined);

      if (zoneStrategy === 'fused') {
        const fused = this._computeFusedZone(zone, zoneCamIds);
        const rawCounts = Object.fromEntries(zoneCamIds.map(cid => [cid, perCamera[cid]?.zones?.[zone.id] ?? 0]));
        if (fused?.usable) {
          aggregatedZones[zone.id] = fused.fusedCount;
          fusionZones[zone.id] = fused;
        } else {
          aggregatedZones[zone.id] = values.length > 0 ? Math.max(...values) : 0;
          fusionZones[zone.id] = {
            enabled: !!(this.cvConfig.fusion?.enabled),
            usable: false,
            fallback: 'max',
            rawCounts,
            reason: fused?.reason || 'Fusão geométrica não calibrada para esta zona',
          };
        }
        continue;
      }

      if (values.length === 0) {
        aggregatedZones[zone.id] = 0;
      } else if (zoneStrategy === 'sum') {
        aggregatedZones[zone.id] = values.reduce((a, b) => a + b, 0);
      } else {
        aggregatedZones[zone.id] = Math.max(...values);
      }
    }

    // totalCount: se há zonas configuradas, usa soma das zonas (mais preciso —
    // ignora detecções fora dos polígonos como spots de luz e falsos positivos).
    // Sem zonas: fallback para max de câmeras (comportamento legado).
    const hasZones = zonesConfig.length > 0 && Object.keys(aggregatedZones).length > 0;
    const totalCount = hasZones
      ? Object.values(aggregatedZones).reduce((a, b) => a + b, 0)
      : (strategy === 'sum'
          ? counts.reduce((a, b) => a + b, 0)
          : (counts.length > 0 ? Math.max(...counts) : 0));

    // Agrega dwell time por zona (combina câmeras que veem a mesma zona)
    const aggregatedDwell = {};
    for (const zone of zonesConfig) {
      const zoneCamIds = Array.isArray(zone.cameras) ? zone.cameras : Object.keys(zone.cameras || {});
      const allSamples = [];
      let totalActive = 0;
      for (const cid of zoneCamIds) {
        const camDwell = perCamera[cid]?.dwell?.[zone.id];
        if (camDwell?.samples) {
          allSamples.push(camDwell);
        }
        totalActive += perCamera[cid]?.activeVisitors?.[zone.id] || 0;
      }
      if (allSamples.length > 0) {
        const totalSamp = allSamples.reduce((a, d) => a + d.samples, 0);
        const weightedAvg = allSamples.reduce((a, d) => a + d.avgSeconds * d.samples, 0) / totalSamp;
        aggregatedDwell[zone.id] = {
          samples: totalSamp,
          avgSeconds: Math.round(weightedAvg),
          avgFormatted: weightedAvg >= 60 ? `${Math.floor(weightedAvg/60)}m${Math.round(weightedAvg%60).toString().padStart(2,'0')}s` : `${Math.round(weightedAvg)}s`,
          maxSeconds: Math.max(...allSamples.map(d => d.maxSeconds)),
          activeVisitors: totalActive,
        };
      }
    }

    const counterData = this.cvConfig.counter?.enabled ? this._readCounterData() : null;
    const counterUnits = this.cvConfig.counter?.enabled
      ? (this.cvConfig.counter.mode === 'dual'
          ? ['entry', 'exit'].map(role => this._getCounterRuntimeStatus(role, this.counterProcesses.get(role)))
          : [this._getCounterRuntimeStatus('single', this.counterProcess)])
      : [];
    const readyCounterCount = counterUnits.filter(unit => unit.ready).length;

    return {
      enabled: this.cvConfig.enabled || false,
      running: this.processes.size === expectedDetectorCount && expectedDetectorCount > 0,
      ready: this.processes.size === expectedDetectorCount
        && this._readyInfo.size >= expectedDetectorCount
        && this.reidProcesses.size === expectedReidCount
        && this._reidReady.size >= expectedReidCount
        && (this.counterProcesses.size + (this.counterProcess ? 1 : 0)) === expectedCounterCount
        && readyCounterCount === expectedCounterCount,
      cardinality: {
        detectors: { expected: expectedDetectorCount, running: this.processes.size, ready: this._readyInfo.size },
        reid: { expected: expectedReidCount, running: this.reidProcesses.size, ready: this._reidReady.size },
        counters: {
          expected: expectedCounterCount,
          running: this.counterProcesses.size + (this.counterProcess ? 1 : 0),
          ready: readyCounterCount,
          units: counterUnits,
        },
      },
      cameras: cvCameras.length,
      countStrategy: strategy,
      totalCount,
      zones: aggregatedZones,
      dwell: aggregatedDwell,
      zonesConfig: (this.cvConfig.zones || []).map(z => ({
        id: z.id,
        name: z.name,
        strategy: z.strategy || 'max',
        cameras: z.cameras,
        alert: z.alert,
      })),
      fusion: Object.keys(fusionZones).length > 0 ? {
        enabled: !!(this.cvConfig.fusion?.enabled),
        zones: fusionZones,
      } : null,
      perCamera,
      counter: counterData
        ? {
            running: this.counterProcess != null || this.counterProcesses.size > 0,
            pid: this.counterProcess?.pid || null,
            pids: [...this.counterProcesses.values()].map(p => p.pid),
            ...counterData
          }
        : { running: this.counterProcess != null || this.counterProcesses.size > 0, enabled: !!(this.cvConfig.counter?.enabled) },
      model: this.cvConfig.detectorModel || this.cvConfig.model || 'yolo11n',
      gpu: this.cvConfig.gpu ?? 0,
      protocol: 'jsonl-v2',
    };
  }

  _computeFusedZone(zone, zoneCamIds) {
    const fusionConfig = this.cvConfig?.fusion || {};
    if (!fusionConfig.enabled) {
      return { usable: false, reason: 'cv.fusion.enabled = false' };
    }
    if (!Array.isArray(zoneCamIds) || zoneCamIds.length !== 2) {
      return { usable: false, reason: 'MVP de fusão suporta exatamente 2 câmeras por zona' };
    }

    const [camA, camB] = zoneCamIds;
    const projA = this._projectZoneDetections(camA, zone.id);
    const projB = this._projectZoneDetections(camB, zone.id);

    if (!projA.usable || !projB.usable) {
      return {
        usable: false,
        reason: projA.reason || projB.reason || 'Falha ao projetar pontos para o plano comum',
        rawCounts: {
          [camA]: projA.rawCount,
          [camB]: projB.rawCount,
        },
      };
    }

    const mergeDistance = Number(fusionConfig.mergeDistance ?? 80);
    const matches = this._greedyBipartiteMatches(projA.points, projB.points, mergeDistance);
    const fusedCount = projA.points.length + projB.points.length - matches.length;

    return {
      usable: true,
      algorithm: 'pairwise-homography-greedy',
      mergeDistance,
      rawCounts: {
        [camA]: projA.rawCount,
        [camB]: projB.rawCount,
      },
      projectedCounts: {
        [camA]: projA.points.length,
        [camB]: projB.points.length,
      },
      matches: matches.length,
      fusedCount,
      sampleMatches: matches.slice(0, 10).map(m => ({
        distance: +m.distance.toFixed(1),
        a: { x: Math.round(m.a.point.x), y: Math.round(m.a.point.y) },
        b: { x: Math.round(m.b.point.x), y: Math.round(m.b.point.y) },
      })),
    };
  }

  _projectZoneDetections(camId, zoneId) {
    const cached = this._cache.get(camId);
    const detections = (cached?.detections || []).filter(det => {
      if (!Array.isArray(det.zones) || det.zones.length === 0) return true;
      return det.zones.includes(zoneId);
    });

    const fusionCam = this.cvConfig?.fusion?.cameras?.[camId];
    if (!fusionCam?.src || !fusionCam?.dst) {
      return {
        usable: false,
        rawCount: detections.length,
        reason: `cv.fusion.cameras.${camId} sem src/dst`,
      };
    }

    const H = this._buildHomography(fusionCam.src, fusionCam.dst);
    if (!H) {
      return {
        usable: false,
        rawCount: detections.length,
        reason: `Homografia inválida para ${camId}`,
      };
    }

    const points = [];
    for (const det of detections) {
      const foot = { x: det.x + det.w / 2, y: det.y + det.h };
      const mapped = this._applyHomography(H, foot);
      if (!mapped) continue;
      points.push({ camId, point: mapped, foot, detection: det });
    }

    return {
      usable: true,
      rawCount: detections.length,
      points,
    };
  }

  _greedyBipartiteMatches(pointsA, pointsB, threshold) {
    const edges = [];
    for (let i = 0; i < pointsA.length; i++) {
      for (let j = 0; j < pointsB.length; j++) {
        const dx = pointsA[i].point.x - pointsB[j].point.x;
        const dy = pointsA[i].point.y - pointsB[j].point.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= threshold) {
          edges.push({ i, j, distance, a: pointsA[i], b: pointsB[j] });
        }
      }
    }

    edges.sort((a, b) => a.distance - b.distance);

    const usedA = new Set();
    const usedB = new Set();
    const matches = [];

    for (const edge of edges) {
      if (usedA.has(edge.i) || usedB.has(edge.j)) continue;
      usedA.add(edge.i);
      usedB.add(edge.j);
      matches.push(edge);
    }

    return matches;
  }

  _buildHomography(srcPoints, dstPoints) {
    if (!Array.isArray(srcPoints) || !Array.isArray(dstPoints) || srcPoints.length < 4 || dstPoints.length < 4) {
      return null;
    }

    const A = [];
    const b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = srcPoints[i];
      const [X, Y] = dstPoints[i];
      if (![x, y, X, Y].every(Number.isFinite)) return null;
      A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
      b.push(X);
      A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
      b.push(Y);
    }

    const h = this._solveLinearSystem(A, b);
    return h ? [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1] : null;
  }

  _applyHomography(H, point) {
    if (!Array.isArray(H) || H.length !== 9) return null;
    const x = point.x;
    const y = point.y;
    const denom = H[6] * x + H[7] * y + H[8];
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-6) return null;
    return {
      x: (H[0] * x + H[1] * y + H[2]) / denom,
      y: (H[3] * x + H[4] * y + H[5]) / denom,
    };
  }

  _solveLinearSystem(A, b) {
    const n = A.length;
    if (n === 0 || b.length !== n) return null;
    const M = A.map((row, i) => [...row, b[i]]);

    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
      }
      if (Math.abs(M[pivot][col]) < 1e-9) return null;
      if (pivot !== col) [M[col], M[pivot]] = [M[pivot], M[col]];

      const div = M[col][col];
      for (let j = col; j <= n; j++) M[col][j] /= div;

      for (let row = 0; row < n; row++) {
        if (row === col) continue;
        const factor = M[row][col];
        if (Math.abs(factor) < 1e-12) continue;
        for (let j = col; j <= n; j++) {
          M[row][j] -= factor * M[col][j];
        }
      }
    }

    return M.map(row => row[n]);
  }

  getDetections(camId) {
    // Retorna cache em memória (do JSONL) em vez de ler arquivo
    const cached = this._cache.get(camId);
    if (cached) return cached;
    // Fallback: arquivo (backward compat com processos antigos)
    return this._readDetectionsFile(camId);
  }

  getHeatmap(camId) {
    const file = camId
      ? path.join(OUTPUT_DIR, camId, 'heatmap.png')
      : path.join(OUTPUT_DIR, 'heatmap.png');
    if (!fs.existsSync(file)) return null;
    try { return fs.readFileSync(file); } catch { return null; }
  }

  getFrame(camId) {
    const file = camId
      ? path.join(OUTPUT_DIR, camId, 'frame.jpg')
      : path.join(OUTPUT_DIR, 'frame.jpg');
    if (!fs.existsSync(file)) return null;
    try { return fs.readFileSync(file); } catch { return null; }
  }

  resetHeatmap(camId) {
    const dirs = camId ? [path.join(OUTPUT_DIR, camId)] : this._getCameraDirs();
    let ok = true;
    for (const dir of dirs) {
      try {
        const raw = path.join(dir, 'heatmap_raw.npy');
        const png = path.join(dir, 'heatmap.png');
        if (fs.existsSync(raw)) fs.unlinkSync(raw);
        if (fs.existsSync(png)) fs.unlinkSync(png);
      } catch { ok = false; }
    }
    return ok;
  }

  getCounterData() { return this._readCounterData(); }
  getCounterFrame() {
    const mode = this.cvConfig?.counter?.mode || 'single';
    const file = mode === 'dual'
      ? (fs.existsSync(path.join(OUTPUT_DIR, 'counter', 'entry', 'frame.jpg'))
          ? path.join(OUTPUT_DIR, 'counter', 'entry', 'frame.jpg')
          : path.join(OUTPUT_DIR, 'counter', 'exit', 'frame.jpg'))
      : path.join(OUTPUT_DIR, 'counter', 'frame.jpg');
    if (!fs.existsSync(file)) return null;
    try { return fs.readFileSync(file); } catch { return null; }
  }

  // ─── ReID API ──────────────────────────────────────────────────────────────

  getReidStats() {
    const stats = {};
    for (const [camId, cache] of this._reidCache) {
      stats[camId] = {
        uniqueVisitors: cache.uniqueVisitors || 0,
        activeIdentities: cache.activeIdentities || 0,
        staffFiltered: cache.staffFiltered || 0,
        timestamp: cache.timestamp || null,
        running: this.reidProcesses.has(camId),
        pid: this.reidProcesses.get(camId)?.pid || null,
      };
    }
    return stats;
  }

  getReidToday() {
    // Agregado cross-camera
    const allCaches = Array.from(this._reidCache.values());
    if (allCaches.length === 0) return null;

    // Sum unique visitors across cameras (assuming reid_ids are global)
    const totalVisitors = Math.max(...allCaches.map(c => c.uniqueVisitors || 0), 0);
    const totalActive = allCaches.reduce((sum, c) => sum + (c.activeIdentities || 0), 0);
    const totalStaff = Math.max(...allCaches.map(c => c.staffFiltered || 0), 0);

    return {
      uniqueVisitors: totalVisitors,
      activeIdentities: totalActive,
      staffFiltered: totalStaff,
      perCamera: this.getReidStats(),
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Lifecycle restart guards ──────────────────────────────────────────────

  _cancelRestartTimer(key) {
    const timer = this._restartTimers.get(key);
    if (timer === undefined || timer === null) return;
    this._clearTimeout(timer);
    this._restartTimers.delete(key);
  }

  _cancelRestartTimers() {
    for (const timer of this._restartTimers.values()) {
      this._clearTimeout(timer);
    }
    this._restartTimers.clear();
  }

  _scheduleRestart(key, generation, callback, delayMs = 10000) {
    if (!this.enabled || !this._active || generation !== this._generation) return null;

    this._cancelRestartTimer(key);
    const timer = this._setTimeout(() => {
      if (this._restartTimers.get(key) !== timer) return;
      this._restartTimers.delete(key);
      if (!this.enabled || !this._active || generation !== this._generation) return;
      callback();
    }, delayMs);
    this._restartTimers.set(key, timer);
    if (timer?.unref) timer.unref();
    return timer;
  }

  _ownsProcess(map, key, proc, generation) {
    const current = map.get(key);
    return !!current && current.process === proc && current.generation === generation;
  }

  // ─── Private: processo detector ────────────────────────────────────────────

  _startDetector(camId, pythonCmd, configPath, generation = this._generation) {
    if (!this.enabled || !this._active || generation !== this._generation) return null;
    const existing = this.processes.get(camId);
    if (existing) return existing;
    this._cancelRestartTimer(`detector:${camId}`);

    const cam = this.camerasConfig.find(c => c.id === camId);
    if (!cam) {
      console.log(`  👁️ CV: câmera ${camId} não encontrada no config`);
      return;
    }

    // Garante diretório de output por câmera
    const camOutDir = path.join(OUTPUT_DIR, camId);
    if (!fs.existsSync(camOutDir)) fs.mkdirSync(camOutDir, { recursive: true });

    // URL-encode credenciais
    const user = encodeURIComponent(cam.user || 'admin');
    const pass = cam.password ? encodeURIComponent(cam.password) : '';
    const rtspUrl = `rtsp://${user}:${pass}@${cam.ip}:554/cam/realmonitor?channel=1&subtype=0`;

    const detectorModel = this.cvConfig.detectorModel || this.cvConfig.model || 'yolo11n';
    const args = [
      path.join(CV_DIR, 'detector.py'),
      '--camera-id', camId,
      '--rtsp', rtspUrl,
      '--gpu', String(this.cvConfig.gpu ?? 0),
      '--interval', String(this.cvConfig.interval ?? 0),
      '--model', detectorModel,
      '--confidence', String(this.cvConfig.confidence ?? 0.4),
      '--heatmap-decay', String(this.cvConfig.heatmapDecay ?? 0.999),
      '--imgsz', String(this.cvConfig.imgsz ?? 640),
    ];

    if (configPath) args.push('--config', configPath);
    if (this.cvConfig.noTrt) args.push('--no-trt');

    console.log(`  👁️ CV [${camId}]: iniciando (${detectorModel}, GPU ${this.cvConfig.gpu ?? 0})`);

    const proc = this._spawn(pythonCmd, args, {
      cwd: CV_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const entry = { process: proc, pid: proc.pid, camId, generation };
    this.processes.set(camId, entry);

    // ─── stdout: protocolo JSONL ──────────────────────────────────────────────
    this._buffers.set(camId, '');

    proc.stdout.on('data', (data) => {
      if (!this._ownsProcess(this.processes, camId, proc, generation)) return;
      // Acumula buffer (pode chegar fragmentado)
      const buf = (this._buffers.get(camId) || '') + data.toString();
      const lines = buf.split('\n');
      this._buffers.set(camId, lines.pop()); // guarda fragmento incompleto

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Tenta parsear como JSON
        let event;
        try {
          event = JSON.parse(trimmed);
        } catch {
          // Linha de log não-JSON — exibe normalmente
          console.log(`  👁️ [${camId}] ${trimmed}`);
          continue;
        }

        this._handleEvent(camId, event);
      }
    });

    // stderr: logs Python (model loading, warnings, erros internos)
    proc.stderr.on('data', (data) => {
      if (!this._ownsProcess(this.processes, camId, proc, generation)) return;
      data.toString().trim().split('\n').forEach(line => {
        if (line.trim()) console.log(`  👁️ [${camId}] ${line.trim()}`);
      });
    });
    const handleTermination = (code, err = null) => {
      if (!this._ownsProcess(this.processes, camId, proc, generation)) return;
      if (err) console.error(`  👁️ CV [${camId}]: falha de processo — ${err.message}`);
      else console.log(`  👁️ CV [${camId}]: processo encerrado (code ${code})`);
      this.processes.delete(camId);
      this._buffers.delete(camId);
      this._readyInfo.delete(camId);

      if (this.enabled && this._active && generation === this._generation) {
        console.log(`  👁️ CV [${camId}]: reiniciando em 10s...`);
        this._scheduleRestart(`detector:${camId}`, generation, () => {
          if (this.processes.has(camId)) return;
          const py = this._findPython();
          if (py) this._startDetector(camId, py, configPath, generation);
        });
      }
    };
    proc.once('error', err => handleTermination(null, err));
    proc.once('exit', code => handleTermination(code));

    return entry;
  }

  /**
   * Processa evento JSONL recebido do Python.
   * Atualiza cache interno e emite evento Node.js correspondente.
   */
  _handleEvent(camId, event) {
    switch (event.event) {
      case 'ready':
        this._readyInfo.set(camId, {
          model: event.model,
          format: event.format,
          gpuName: event.gpuName,
          zones: event.zones || [],
          resolution: event.resolution,
        });
        console.log(`  👁️ CV [${camId}]: pronto | ${event.format} | GPU: ${event.gpuName} | zonas: ${(event.zones || []).join(', ') || 'nenhuma'}`);
        this.emit('ready', { camId, ...event });
        break;

      case 'detection': {
        // Atualiza cache (em memória — sem I/O de arquivo)
        const payload = {
          count: event.count,
          fps: event.fps,
          zones: event.zones || {},
          detections: event.detections || [],
          dwell: event.dwell || {},
          activeVisitors: event.activeVisitors || {},
          resolution: event.resolution,
          model: event.model,
          format: event.format,
          timestamp: event.timestamp,
          camera: camId,
        };
        this._cache.set(camId, payload);
        this.emit('detection', { camId, ...payload });
        break;
      }

      case 'status':
        // Reemite para quem precisar
        this.emit('status', { camId, ...event });
        break;

      case 'error':
        console.error(`  👁️ CV [${camId}] erro: ${event.message}`);
        this.emit('error', { camId, ...event });
        break;

      default:
        // Evento desconhecido — ignora silenciosamente
        break;
    }
  }

  // ─── ReID Process ──────────────────────────────────────────────────────────

  _startReid(camId, pythonCmd, configPath, generation = this._generation) {
    if (!this.enabled || !this._active || generation !== this._generation) return null;
    const existing = this.reidProcesses.get(camId);
    if (existing) return existing;
    this._cancelRestartTimer(`reid:${camId}`);

    if (!configPath) {
      console.log(`  🔍 ReID [${camId}]: sem config path, pulando`);
      return;
    }

    const args = [
      path.join(CV_DIR, 'reid.py'),
      '--config', configPath,
      '--camera-id', camId,
    ];

    console.log(`  🔍 ReID [${camId}]: iniciando`);

    const proc = this._spawn(pythonCmd, args, {
      cwd: CV_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const entry = { process: proc, pid: proc.pid, camId, generation };
    this.reidProcesses.set(camId, entry);

    // ─── stdout: protocolo JSONL ──────────────────────────────────────────────
    this._reidBuffers.set(camId, '');

    proc.stdout.on('data', (data) => {
      if (!this._ownsProcess(this.reidProcesses, camId, proc, generation)) return;
      const buf = (this._reidBuffers.get(camId) || '') + data.toString();
      const lines = buf.split('\n');
      this._reidBuffers.set(camId, lines.pop());

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let event;
        try {
          event = JSON.parse(trimmed);
        } catch {
          console.log(`  🔍 [${camId}] ${trimmed}`);
          continue;
        }

        this._handleReidEvent(camId, event);
      }
    });

    // stderr: logs Python
    proc.stderr.on('data', (data) => {
      if (!this._ownsProcess(this.reidProcesses, camId, proc, generation)) return;
      data.toString().trim().split('\n').forEach(line => {
        if (line.trim()) console.log(`  🔍 [${camId}] ${line.trim()}`);
      });
    });
    const handleTermination = (code, err = null) => {
      if (!this._ownsProcess(this.reidProcesses, camId, proc, generation)) return;
      if (err) console.error(`  🔍 ReID [${camId}]: falha de processo — ${err.message}`);
      else console.log(`  🔍 ReID [${camId}]: processo encerrado (code ${code})`);
      this.reidProcesses.delete(camId);
      this._reidBuffers.delete(camId);
      this._reidReady.delete(camId);

      if (this.enabled && this._active && generation === this._generation) {
        console.log(`  🔍 ReID [${camId}]: reiniciando em 10s...`);
        this._scheduleRestart(`reid:${camId}`, generation, () => {
          if (this.reidProcesses.has(camId)) return;
          const py = this._findPython();
          if (py) this._startReid(camId, py, configPath, generation);
        });
      }
    };
    proc.once('error', err => handleTermination(null, err));
    proc.once('exit', code => handleTermination(code));

    return entry;
  }

  _handleReidEvent(camId, event) {
    switch (event.event) {
      case 'ready':
        this._reidReady.add(camId);
        console.log(`  🔍 ReID [${camId}]: pronto | ${event.backend} | zonas: ${(event.sameZoneCameras || []).join(', ') || 'nenhuma'}`);
        this.emit('reid_ready', { camId, ...event });
        break;

      case 'match':
      case 'new_identity': {
        // Cache eventos ReID — rolling window (evita crescimento infinito)
        const REID_CACHE_MAX = 500;
        if (!this._reidCache.has(camId)) {
          this._reidCache.set(camId, { matches: [], newIdentities: [] });
        }
        const reidCache = this._reidCache.get(camId);
        if (event.event === 'match') {
          reidCache.matches.push(event);
          if (reidCache.matches.length > REID_CACHE_MAX) reidCache.matches.shift();
        } else {
          reidCache.newIdentities.push(event);
          if (reidCache.newIdentities.length > REID_CACHE_MAX) reidCache.newIdentities.shift();
        }
        this.emit(event.event === 'match' ? 'reid_match' : 'reid_new_identity', { camId, ...event });
        break;
      }

      case 'status':
        // Armazena status ReID
        if (!this._reidCache.has(camId)) {
          this._reidCache.set(camId, {});
        }
        Object.assign(this._reidCache.get(camId), {
          uniqueVisitors: event.uniqueVisitors,
          activeIdentities: event.activeIdentities,
          staffFiltered: event.staffFiltered,
          timestamp: event.timestamp,
        });
        this.emit('reid_status', { camId, ...event });
        break;

      case 'error':
        console.error(`  🔍 ReID [${camId}] erro: ${event.message}`);
        this.emit('reid_error', { camId, ...event });
        break;

      default:
        break;
    }
  }

  // ─── Visitor Counter (arquivo-based, inalterado) ───────────────────────────

  // Dual-camera helper: one instance per role ('entry' or 'exit')
  _startCounterInstance(pythonCmd, configPath, cfg, role, generation = this._generation) {
    if (!this.enabled || !this._active || generation !== this._generation) return null;
    const existing = this.counterProcesses.get(role);
    if (existing) return existing;
    this._cancelRestartTimer(`counter:${role}`);

    const camId = cfg.camera || (role === 'entry' ? 'cam-1' : 'cam-2');
    const cam = this.camerasConfig.find(c => c.id === camId);
    const user = cam ? encodeURIComponent(cam.user || 'admin') : 'admin';
    const pass = cam?.password ? encodeURIComponent(cam.password) : '';
    const rtspUrl = cam
      ? `rtsp://${user}:${pass}@${cam.ip}:554/cam/realmonitor?channel=1&subtype=0`
      : null;

    const counterModel = cfg.model || this.cvConfig.counter?.model || this.cvConfig.model || 'yolo11n';
    const args = [
      path.join(CV_DIR, 'counter.py'),
      '--mode', role,
      '--gpu', String(this.cvConfig.gpu ?? 0),
      '--line', cfg.line || '500,480,1400,480',
      '--confidence', String(cfg.confidence ?? 0.45),
      '--interval', String(cfg.interval ?? 0.5),
      '--model', counterModel,
    ];
    if (rtspUrl) args.push('--rtsp', rtspUrl);
    if (configPath) args.push('--config', configPath);

    console.log(`  👁️ CV [counter-${role}]: iniciando em ${camId}`);
    try { fs.unlinkSync(this._counterStatusPath(role)); } catch {}

    const proc = this._spawn(pythonCmd, args, {
      cwd: CV_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const entry = { process: proc, pid: proc.pid, role, generation, startedAt: Date.now() };
    this.counterProcesses.set(role, entry);

    proc.stdout.on('data', d => {
      if (!this._ownsProcess(this.counterProcesses, role, proc, generation)) return;
      d.toString().trim().split('\n').forEach(l => l.trim() && console.log(`  👁️ [counter-${role}] ${l.trim()}`));
    });
    proc.stderr.on('data', d => {
      if (!this._ownsProcess(this.counterProcesses, role, proc, generation)) return;
      d.toString().trim().split('\n').forEach(l => l.trim() && console.error(`  👁️ [counter-${role}] [err] ${l.trim()}`));
    });
    const handleTermination = (code, err = null) => {
      if (!this._ownsProcess(this.counterProcesses, role, proc, generation)) return;
      if (err) console.error(`  👁️ CV [counter-${role}]: falha de processo — ${err.message}`);
      else console.log(`  👁️ CV [counter-${role}]: encerrado (code ${code})`);
      this.counterProcesses.delete(role);
      if (this.enabled && this._active && generation === this._generation) {
        this._scheduleRestart(`counter:${role}`, generation, () => {
          if (this.counterProcesses.has(role)) return;
          const py = this._findPython();
          if (py) this._startCounterInstance(py, configPath, cfg, role, generation);
        });
      }
    };
    proc.once('error', err => handleTermination(null, err));
    proc.once('exit', code => handleTermination(code));

    return entry;
  }

  _startCounter(pythonCmd, configPath, counterCfg, generation = this._generation) {
    if (!this.enabled || !this._active || generation !== this._generation) return null;
    if (this.counterProcess) return this.counterProcess;
    this._cancelRestartTimer('counter:single');

    const camId = counterCfg.camera || 'cam-2';
    const cam = this.camerasConfig.find(c => c.id === camId);
    const user = cam ? encodeURIComponent(cam.user || 'admin') : 'admin';
    const pass = cam?.password ? encodeURIComponent(cam.password) : '';
    const rtspUrl = cam
      ? `rtsp://${user}:${pass}@${cam.ip}:554/cam/realmonitor?channel=1&subtype=0`
      : null;

    const counterModel = counterCfg.model || this.cvConfig.counter?.model || this.cvConfig.model || 'yolo11n';
    const args = [
      path.join(CV_DIR, 'counter.py'),
      '--gpu', String(this.cvConfig.gpu ?? 0),
      '--line', counterCfg.line || '500,480,1400,480',
      '--confidence', String(counterCfg.confidence ?? 0.45),
      '--interval', String(counterCfg.interval ?? 0.5),
      '--model', counterModel,
    ];

    if (rtspUrl) args.push('--rtsp', rtspUrl);
    if (configPath) args.push('--config', configPath);

    console.log(`  👁️ CV [counter]: iniciando em ${camId}`);
    try { fs.unlinkSync(this._counterStatusPath('single')); } catch {}

    const proc = this._spawn(pythonCmd, args, {
      cwd: CV_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const entry = { process: proc, pid: proc.pid, generation, startedAt: Date.now() };
    this.counterProcess = entry;
    const ownsProcess = () => this.counterProcess?.process === proc
      && this.counterProcess?.generation === generation;

    proc.stdout.on('data', d => {
      if (!ownsProcess()) return;
      d.toString().trim().split('\n').forEach(l => l.trim() && console.log(`  👁️ [counter] ${l.trim()}`));
    });
    proc.stderr.on('data', d => {
      if (!ownsProcess()) return;
      d.toString().trim().split('\n').forEach(l => l.trim() && console.error(`  👁️ [counter] [err] ${l.trim()}`));
    });
    const handleTermination = (code, err = null) => {
      if (!ownsProcess()) return;
      if (err) console.error(`  👁️ CV [counter]: falha de processo — ${err.message}`);
      else console.log(`  👁️ CV [counter]: encerrado (code ${code})`);
      this.counterProcess = null;
      if (this.enabled && this._active && generation === this._generation) {
        this._scheduleRestart('counter:single', generation, () => {
          if (this.counterProcess) return;
          const py = this._findPython();
          if (py) this._startCounter(py, configPath, counterCfg, generation);
        });
      }
    };
    proc.once('error', err => handleTermination(null, err));
    proc.once('exit', code => handleTermination(code));

    return entry;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  _counterStatusPath(role) {
    return role === 'single'
      ? path.join(OUTPUT_DIR, 'counter', 'status.json')
      : path.join(OUTPUT_DIR, 'counter', role, 'status.json');
  }

  _getCounterRuntimeStatus(role, entry) {
    const status = this._readJsonFile(this._counterStatusPath(role));
    const timestampMs = Date.parse(status?.timestamp || '');
    const freshForProcess = !!entry && Number.isFinite(timestampMs) && timestampMs >= (entry.startedAt - 2000);
    return {
      role,
      status: status?.status || 'missing',
      timestamp: status?.timestamp || null,
      ready: !!entry && status?.status === 'running' && freshForProcess,
    };
  }

  _readDetectionsFile(camId) {
    const file = camId
      ? path.join(OUTPUT_DIR, camId, 'detections.json')
      : path.join(OUTPUT_DIR, 'detections.json');
    if (!fs.existsSync(file)) return null;
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
  }

  _readJsonFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
  }

  _readCounterData() {
    const mode = this.cvConfig?.counter?.mode || 'single';
    if (mode === 'dual') {
      const entryCfg = this.cvConfig?.counter?.entry || {};
      const exitCfg = this.cvConfig?.counter?.exit || {};
      const entryFile = path.join(OUTPUT_DIR, 'counter', 'entry', 'count.json');
      const exitFile  = path.join(OUTPUT_DIR, 'counter', 'exit',  'count.json');
      const entry = this._readJsonFile(entryFile);
      const exit_ = this._readJsonFile(exitFile);
      if (!entry && !exit_) return null;

      // Ambas as portas são bidirecionais: somar entradas E saídas de ambos os processos
      const entries = (entry?.entries ?? 0) + (exit_?.entries ?? 0);
      const exits   = (entry?.exits ?? 0)   + (exit_?.exits ?? 0);
      const hours = new Set([
        ...Object.keys(entry?.hourly || {}),
        ...Object.keys(exit_?.hourly || {}),
      ]);
      const hourly = {};
      for (const hour of [...hours].sort()) {
        hourly[hour] = {
          entries: (entry?.hourly?.[hour]?.entries ?? 0) + (exit_?.hourly?.[hour]?.entries ?? 0),
          exits:   (entry?.hourly?.[hour]?.exits ?? 0)   + (exit_?.hourly?.[hour]?.exits ?? 0),
        };
      }

      return {
        mode: 'dual',
        entries,
        exits,
        occupancy: Math.max(0, entries - exits),
        hourly,
        date: entry?.date || exit_?.date || new Date().toISOString().slice(0, 10),
        entry: entry ? { ...entry, camera: entryCfg.camera || 'cam-1', line: entryCfg.line || null } : { camera: entryCfg.camera || 'cam-1', line: entryCfg.line || null },
        exit:  exit_  ? { ...exit_,  camera: exitCfg.camera || 'cam-2',  line: exitCfg.line || null } : { camera: exitCfg.camera || 'cam-2',  line: exitCfg.line || null },
        timestamp: new Date().toISOString(),
      };
    }
    return this._readJsonFile(path.join(OUTPUT_DIR, 'counter', 'count.json'));
  }

  _getCameraDirs() {
    try {
      return fs.readdirSync(OUTPUT_DIR)
        .filter(d => d.startsWith('cam-'))
        .map(d => path.join(OUTPUT_DIR, d));
    } catch { return []; }
  }

  _findPython() {
    // Venv first — on Windows, the venv launcher spawns system python as a child
    // process, but crucially it activates the virtual environment so the child
    // inherits torch/ultralytics/etc from venv site-packages. Running system
    // Python directly would fail on import (deps not installed globally).
    // The tree-kill in stop() handles orphan child processes on Windows.
    const candidates = [
      path.join(CV_DIR, 'venv', 'Scripts', 'python.exe'),
      path.join(CV_DIR, 'venv', 'bin', 'python'),
      'C:\\Users\\AYA\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
      'C:\\Users\\Ihon\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
      'python',
      'python3',
    ];
    for (const cmd of candidates) {
      try {
        const { execSync } = require('child_process');
        execSync(`"${cmd}" --version`, { stdio: 'ignore', timeout: 5000 });
        return cmd;
      } catch {}
    }
    return null;
  }

  _getConfigPath() {
    // Tenta ler do argv (--config=beleza-astral) ou usa o primeiro config disponível
    // __dirname = clusters/cv → sobe 2 níveis até a raiz do repo antes de entrar em config/
    const configArg = process.argv.find(a => a.startsWith('--config='));
    const configName = configArg ? configArg.split('=')[1] : null;
    const configDir = path.join(__dirname, '..', '..', 'config');
    if (configName) {
      const p = path.join(configDir, `${configName}.json`);
      if (fs.existsSync(p)) return p;
    }
    // Detecta automaticamente: pega o primeiro config da pasta (exceto template)
    try {
      const files = fs.readdirSync(configDir).filter(f => f.endsWith('.json') && f !== 'template.json');
      if (files.length > 0) return path.join(configDir, files[0]);
    } catch {}
    return null;
  }
}

module.exports = { CVManager };
