/**
 * AYA Expo Tools ÔÇö Computer Vision Manager v2
 *
 * v2: protocolo JSONL stdout (zero lat├¬ncia) em vez de polling de arquivo.
 *     Python emite eventos linha a linha; Node l├¬ e processa em tempo real.
 *     Arquivos (heatmap.png, frame.jpg) ainda servidos como static.
 *
 * API p├║blica (inalterada):
 *   cvManager.start()
 *   cvManager.stop()
 *   cvManager.getStatus()           ÔåÆ { enabled, running, totalCount, perCamera, zones, ... }
 *   cvManager.getDetections(camId)  ÔåÆ { count, detections, zones, fps, timestamp }
 *   cvManager.getHeatmap(camId)     ÔåÆ Buffer (PNG) | null
 *   cvManager.getFrame(camId)       ÔåÆ Buffer (JPEG) | null
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

const CV_DIR = path.join(__dirname, '..', 'cv');
const OUTPUT_DIR = path.join(CV_DIR, 'output');

class CVManager extends EventEmitter {
  constructor(config) {
    super();
    // EventEmitter: sem listener para 'error' ÔåÆ uncaught exception. Handler padr├úo.
    this.on('error', (err) => {
      console.error(`  ­ƒÄÑ­ƒö┤ CV [${err?.camId || '?'}] erro: ${err?.message || err}`);
    });
    this.config = config;
    this.cvConfig = config.cv || {};
    this.camerasConfig = config.cameras || [];
    this.enabled = !!this.cvConfig.enabled;

    this.processes = new Map();   // camId ÔåÆ { process, pid, camId }
    this.counterProcess = null;
    if (this.reidProcess) { try { this.reidProcess.process.kill("SIGTERM"); } catch {} this.reidProcess = null; }
    this.reidProcess    = null;
    this._buffers = new Map();    // camId ÔåÆ string (linha parcial)
    this._cache = new Map();      // camId ÔåÆ ├║ltimo evento 'detection' recebido
    this._readyInfo = new Map();  // camId ÔåÆ evento 'ready' (model, format, gpuName)
    this._configPath = null;      // definido no start()
    
    // Ô¡É Peak tracking (v2.1)
    this._peakCount = 0;
    this._peakTimestamp = null;
  }

  // ÔöüÔöüÔöü Public API ÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöü

  start() {
    if (!this.enabled) {
      console.log('  ­ƒÄÑ­ƒƒí CV: desativado (cv.enabled = false no config)');
      return;
    }

    const pythonCmd = this._findPython();
    if (!pythonCmd) {
      console.log('  ­ƒÄÑ­ƒƒí CV: Python n├úo encontrado ÔÇö execute install.bat');
      return;
    }

    const cvCameras = this.cvConfig.cameras || [this.cvConfig.camera || 'cam-1'];
    this._configPath = this._getConfigPath();

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    console.log(`  ­ƒÄÑ­ƒƒó CV v2: iniciando ${cvCameras.length} detector(es) | JSONL protocol`);

    for (const camId of cvCameras) {
      this._startDetector(camId, pythonCmd, this._configPath);
    }

    // Visitor counter (ainda usa arquivo ÔÇö n├úo muda nesta vers├úo)
    const counterCfg = this.cvConfig.counter;
    if (counterCfg?.enabled) {
      this._startCounter(pythonCmd, this._configPath, counterCfg);
    this._startReid(pythonCmd, this._configPath);
    }
  }

  stop() {
    this.enabled = false;

    // Collect PIDs before killing (needed for tree-kill on Windows)
    const pids = [];
    for (const [camId, entry] of this.processes) {
      console.log(`  ­ƒÄÑ­ƒö┤ CV [${camId}]: parando (PID ${entry.pid})...`);
      pids.push(entry.pid);
      try { entry.process.kill('SIGTERM'); } catch {}
    }

    if (this.counterProcess) {
      pids.push(this.counterProcess.pid);
      try { this.counterProcess.process.kill('SIGTERM'); } catch {}
    }

    setTimeout(() => {
      for (const [, entry] of this.processes) {
        try { entry.process.kill('SIGKILL'); } catch {}
      }
      this.processes.clear();
      this._buffers.clear();
      if (this.counterProcess) {
        try { this.counterProcess.process.kill('SIGKILL'); } catch {}
        this.counterProcess = null;
      }

      // Windows: taskkill /T kills entire process tree (catches orphan children
      // from venv launcher or any subprocess). Safe even if PIDs already exited.
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        for (const pid of pids) {
          try {
            execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore', timeout: 5000 });
          } catch {} // ignore ÔÇö process may already be dead
        }
      }
    }, 5000);
  }

  reload(config) {
    this.config = config;
    this.cvConfig = config.cv || {};
    this.camerasConfig = config.cameras || [];
    // Para aplicar mudan├ºas: chamar stop() depois start()
  }

  /**
   * Status agregado ÔÇö shape mantido compat├¡vel com portal-sync e API REST.
   */
  getStatus() {
    const cvCameras = this.cvConfig.cameras || [this.cvConfig.camera || 'cam-1'];
    const strategy = this.cvConfig.countStrategy || 'max';
    const perCamera = {};
    const counts = [];

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
        model: readyInfo.model || this.cvConfig.model || 'yolo11n',
        format: readyInfo.format || 'unknown',
        gpuName: readyInfo.gpuName || null,
        zones: cached?.zones || {},
        dwell: cached?.dwell || {},
        activeVisitors: cached?.activeVisitors || {},
        timestamp: cached?.timestamp || null,
      };
    }

    // Agrega zonas respeitando strategy por zona:
    //   "max" (padr├úo) ÔåÆ c├ómeras no mesmo espa├ºo f├¡sico (ex: cam-1 + cam-3 na sala imersiva)
    //   "sum"          ÔåÆ c├ómeras em espa├ºos distintos sem sobreposi├º├úo
    const zonesConfig = this.cvConfig.zones || [];
    const aggregatedZones = {};

    for (const zone of zonesConfig) {
      const zoneStrategy = zone.strategy || 'max';
      const cameras = zone.cameras || {};
      // Suporta cameras como dict (novo) ou array (legado)
      const zoneCamIds = Array.isArray(cameras) ? cameras : Object.keys(cameras);
      const values = zoneCamIds
        .map(cid => perCamera[cid]?.zones?.[zone.id])
        .filter(v => v !== undefined);

      if (values.length === 0) {
        aggregatedZones[zone.id] = 0;
      } else if (zoneStrategy === 'sum') {
        aggregatedZones[zone.id] = values.reduce((a, b) => a + b, 0);
      } else {
        aggregatedZones[zone.id] = Math.max(...values);
      }
    }

    // totalCount: se h├í zonas configuradas, usa soma das zonas (mais preciso ÔÇö
    // ignora detec├º├Áes fora dos pol├¡gonos como spots de luz e falsos positivos).
    // Sem zonas: fallback para max de c├ómeras (comportamento legado).
    const hasZones = zonesConfig.length > 0 && Object.keys(aggregatedZones).length > 0;
    const totalCount = hasZones
      ? Object.values(aggregatedZones).reduce((a, b) => a + b, 0)
      : (strategy === 'sum'
          ? counts.reduce((a, b) => a + b, 0)
          : (counts.length > 0 ? Math.max(...counts) : 0));

    // Ô¡É Novo pico detectado ÔÇö salvar peak-frame.jpg de todas as c├ómeras
    if (totalCount > this._peakCount) {
      this._peakCount = totalCount;
      this._savePeakFrames(totalCount);
    }

    // Agrega dwell time por zona (combina c├ómeras que veem a mesma zona)
    const aggregatedDwell = {};
    for (const zone of zonesConfig) {
      const zoneCamIds = Array.isArray(zone.cameras) ? zone.cameras : Object.keys(zone.cameras || {});
      const allSamples = [];
      let totalActive = 0;
      for (const cid of zoneCamIds) {
        const camDwell = perCamera[cid]?.dwell?.[zone.id];
        if (camDwell?.samples) {
          // Collect raw avg to combine (best effort without raw data)
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

    const counterData = this._readCounterData();
      const reidState   = this._readReidState();

    return {
      enabled: this.cvConfig.enabled || false,
      running: this.processes.size > 0,
      cameras: cvCameras.length,
      countStrategy: strategy,
      totalCount,
      peak: {
        count: this._peakCount,
        timestamp: this._peakTimestamp,
      },
      zones: aggregatedZones,
      dwell: aggregatedDwell,
      zonesConfig: (this.cvConfig.zones || []).map(z => ({
        id: z.id,
        name: z.name,
        cameras: z.cameras,
        alert: z.alert,
      })),
      perCamera,
      counter: counterData
        ? { running: !!this.counterProcess, pid: this.counterProcess?.pid || null, ...counterData }
        : { running: !!this.counterProcess, enabled: !!(this.cvConfig.counter?.enabled) },
      reid: reidState
        ? { running: !!this.reidProcess, pid: this.reidProcess?.pid || null, ...reidState }
        : { running: !!this.counterProcess, enabled: !!(this.cvConfig.counter?.enabled) },
      model: this.cvConfig.model || 'yolo11n',
      gpu: this.cvConfig.gpu ?? 0,
      protocol: 'jsonl-v2',
    };
  }

  getDetections(camId) {
    // Retorna cache em mem├│ria (do JSONL) em vez de ler arquivo
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

  getReidState() { return this._readReidState(); }

  _readReidState() {
    const file = path.join(OUTPUT_DIR, 'reid', 'state.json');
    if (!fs.existsSync(file)) return null;
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
  }
  getCounterFrame() {
    const file = path.join(OUTPUT_DIR, 'counter', 'frame.jpg');
    if (!fs.existsSync(file)) return null;
    try { return fs.readFileSync(file); } catch { return null; }
  }

  // ÔöüÔöüÔöü Private: peak tracking ÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöü

  /**
   * Salva peak-frame.jpg para cada c├ómera ativa quando h├í novo pico de visitantes.
   * @param {number} totalCount - novo pico de total de pessoas
   */
  _savePeakFrames(totalCount) {
    // Salva peak-frame.jpg para cada c├ómera ativa
    for (const [camId, cam] of this.processes.entries()) {
      const srcPath = path.join(OUTPUT_DIR, camId, 'frame.jpg');
      const dstPath = path.join(OUTPUT_DIR, camId, 'peak-frame.jpg');
      const metaPath = path.join(OUTPUT_DIR, camId, 'peak-meta.json');
      
      try {
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, dstPath);
        }
        fs.writeFileSync(metaPath, JSON.stringify({
          count: totalCount,
          timestamp: new Date().toISOString(),
          camId,
        }, null, 2));
      } catch (e) {
        console.error(`  ­ƒÄÑ­ƒö┤ CV [${camId}] peak-frame copy error: ${e.message}`);
      }
    }
    
    // Salva tamb├®m o frame do counter (se existir)
    const counterSrc = path.join(OUTPUT_DIR, 'counter', 'frame.jpg');
    const counterDst = path.join(OUTPUT_DIR, 'counter', 'peak-frame.jpg');
    try {
      if (fs.existsSync(counterSrc)) {
        fs.copyFileSync(counterSrc, counterDst);
      }
    } catch {}
    
    console.log(`  ­ƒÄÑÔ¡É CV: New peak: ${totalCount} people ÔÇö peak frames saved`);
    this._peakTimestamp = new Date().toISOString();
  }

  // ÔöüÔöüÔöü Private: processo detector ÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöü

  _startDetector(camId, pythonCmd, configPath) {
    const cam = this.camerasConfig.find(c => c.id === camId);
    if (!cam) {
      console.log(`  ­ƒÄÑ­ƒƒí CV: c├ómera ${camId} n├úo encontrada no config`);
      return;
    }

    // Garante diret├│rio de output por c├ómera
    const camOutDir = path.join(OUTPUT_DIR, camId);
    if (!fs.existsSync(camOutDir)) fs.mkdirSync(camOutDir, { recursive: true });

    // URL-encode credenciais
    const user = encodeURIComponent(cam.user || 'admin');
    const pass = cam.password ? encodeURIComponent(cam.password) : '';
    const rtspUrl = `rtsp://${user}:${pass}@${cam.ip}:554/cam/realmonitor?channel=1&subtype=0`;

    const args = [
      path.join(CV_DIR, 'detector.py'),
      '--camera-id', camId,
      '--rtsp', rtspUrl,
      '--gpu', String(this.cvConfig.gpu ?? 0),
      '--interval', String(this.cvConfig.interval ?? 0),
      '--model', this.cvConfig.model || 'yolo11n',
      '--confidence', String(this.cvConfig.confidence ?? 0.4),
      '--heatmap-decay', String(this.cvConfig.heatmapDecay ?? 0.999),
      '--imgsz', String(this.cvConfig.imgsz ?? 640),
    ];

    if (configPath) args.push('--config', configPath);
    if (this.cvConfig.noTrt) args.push('--no-trt');

    console.log(`  ­ƒÄÑ­ƒƒó CV [${camId}]: iniciando (${this.cvConfig.model || 'yolo11n'}, GPU ${this.cvConfig.gpu ?? 0})`);

    const proc = spawn(pythonCmd, args, {
      cwd: CV_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    // ÔöüÔöüÔöü stdout: protocolo JSONL ÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöü
    this._buffers.set(camId, '');

    proc.stdout.on('data', (data) => {
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
          // Linha de log n├úo-JSON ÔÇö exibe normalmente
          console.log(`  ­ƒÄÑ­ƒÆ¼ [${camId}] ${trimmed}`);
          continue;
        }

        this._handleEvent(camId, event);
      }
    });

    // stderr: logs Python (model loading, warnings, erros internos)
    proc.stderr.on('data', (data) => {
      data.toString().trim().split('\n').forEach(line => {
        if (line.trim()) console.log(`  ­ƒÄÑ­ƒÆ¼ [${camId}] ${line.trim()}`);
      });
    });

    proc.on('exit', (code) => {
      console.log(`  ­ƒÄÑ­ƒö┤ CV [${camId}]: processo encerrado (code ${code})`);
      this.processes.delete(camId);
      this._buffers.delete(camId);

      if (this.enabled && code !== 0) {
        console.log(`  ­ƒÄÑ­ƒƒí CV [${camId}]: reiniciando em 10s...`);
        setTimeout(() => {
          if (this.enabled && !this.processes.has(camId)) {
            const py = this._findPython();
            if (py) this._startDetector(camId, py, configPath);
          }
        }, 10000);
      }
    });

    this.processes.set(camId, { process: proc, pid: proc.pid, camId });
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
        console.log(`  ­ƒÄÑÔ£à CV [${camId}]: pronto | ${event.format} | GPU: ${event.gpuName} | zonas: ${(event.zones || []).join(', ') || 'nenhuma'}`);
        this.emit('ready', { camId, ...event });
        break;

      case 'detection': {
        // Atualiza cache (em mem├│ria ÔÇö sem I/O de arquivo)
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
        console.error(`  ­ƒÄÑ­ƒö┤ CV [${camId}] erro: ${event.message}`);
        this.emit('error', { camId, ...event });
        break;

      default:
        // Evento desconhecido ÔÇö ignora silenciosamente
        break;
    }
  }

  // ÔöüÔöüÔöü Visitor Counter (arquivo-based, inalterado) ÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöü

  _startCounter(pythonCmd, configPath, counterCfg) {
    const camId = counterCfg.camera || 'cam-2';
    const cam = this.camerasConfig.find(c => c.id === camId);
    const user = cam ? encodeURIComponent(cam.user || 'admin') : 'admin';
    const pass = cam?.password ? encodeURIComponent(cam.password) : '';
    const rtspUrl = cam
      ? `rtsp://${user}:${pass}@${cam.ip}:554/cam/realmonitor?channel=1&subtype=0`
      : null;

    const args = [
      path.join(CV_DIR, 'counter.py'),
      '--gpu', String(this.cvConfig.gpu ?? 0),
      '--line', counterCfg.line || '500,480,1400,480',
      '--confidence', String(counterCfg.confidence ?? 0.45),
      '--interval', String(counterCfg.interval ?? 0.5),
      '--model', this.cvConfig.model || 'yolo11n',
    ];

    if (rtspUrl) args.push('--rtsp', rtspUrl);
    if (configPath) args.push('--config', configPath);

    console.log(`  ­ƒÄÑ­ƒƒó CV [counter]: iniciando em ${camId}`);

    // Fresh-start marker: garante que todo restart intencional do servidor
    // nao restaure contagens de sessoes anteriores (montagem, etc.)
    try {
      const counterOutDir = path.join(OUTPUT_DIR, 'counter');
      fs.mkdirSync(counterOutDir, { recursive: true });
      fs.writeFileSync(path.join(counterOutDir, 'fresh-start'), new Date().toISOString());
    } catch (e) { /* nao critico */ }

    const proc = spawn(pythonCmd, args, {
      cwd: CV_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    proc.stdout.on('data', d => d.toString().trim().split('\n').forEach(l => l.trim() && console.log(`  ­ƒÄÑ­ƒÆ¼ [counter] ${l.trim()}`)));
    proc.stderr.on('data', d => d.toString().trim().split('\n').forEach(l => l.trim() && console.error(`  ­ƒÄÑ­ƒö┤ [counter] [err] ${l.trim()}`)));

    proc.on('exit', (code) => {
      console.log(`  ­ƒÄÑ­ƒö┤ CV [counter]: encerrado (code ${code})`);
      this.counterProcess = null;
      if (this.enabled && code !== 0) {
        setTimeout(() => {
          if (this.enabled) {
            const py = this._findPython();
            if (py) this._startCounter(py, configPath, counterCfg);
          }
        }, 10000);
      }
    });

    this.counterProcess = { process: proc, pid: proc.pid };
  }

  _startReid(pythonCmd, configPath) {
    // Forçar venv python (reid.py precisa de onnxruntime do venv)
    const venvPy = path.join(CV_DIR, 'venv', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPy)) pythonCmd = venvPy;
    const reidScript = path.join(CV_DIR, 'reid.py');
    if (!fs.existsSync(reidScript)) {
      console.log('  [ReID] reid.py nao encontrado — pulando');
      return;
    }

    const args = [reidScript, '--interval', '2'];
    if (configPath) args.push('--config', configPath);

    console.log('  [ReID] Iniciando reid.py...');

    const proc = require('child_process').spawn(pythonCmd, args, {
      cwd: CV_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    proc.stdout.on('data', d => d.toString().trim().split('\n').forEach(l => l.trim() && console.log('[ReID] ' + l.trim())));
    proc.stderr.on('data', d => d.toString().trim().split('\n').forEach(l => l.trim() && console.error('[ReID][err] ' + l.trim())));

    proc.on('exit', (code) => {
      console.log('[ReID] Encerrado (code ' + code + ')');
      this.reidProcess = null;
      if (this.enabled && code !== 0) {
        setTimeout(() => {
          if (this.enabled) {
            const py = this._findPython();
            if (py) this._startReid(py, configPath);
          }
        }, 10000);
      }
    });

    this.reidProcess = { process: proc, pid: proc.pid };
  }

  // ÔöüÔöüÔöü Helpers ÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöüÔöü

  _readDetectionsFile(camId) {
    const file = camId
      ? path.join(OUTPUT_DIR, camId, 'detections.json')
      : path.join(OUTPUT_DIR, 'detections.json');
    if (!fs.existsSync(file)) return null;
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
  }

  _readCounterData() {
    const file = path.join(OUTPUT_DIR, 'counter', 'count.json');
    if (!fs.existsSync(file)) return null;
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
  }

  _getCameraDirs() {
    try {
      return fs.readdirSync(OUTPUT_DIR)
        .filter(d => d.startsWith('cam-'))
        .map(d => path.join(OUTPUT_DIR, d));
    } catch { return []; }
  }

  _findPython() {
    // Venv first ÔÇö on Windows, the venv launcher spawns system python as a child
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
    // Tenta ler do argv (--config=beleza-astral) ou usa o primeiro config dispon├¡vel
    const configArg = process.argv.find(a => a.startsWith('--config='));
    const configName = configArg ? configArg.split('=')[1] : null;
    if (configName) {
      const p = path.join(__dirname, '..', 'config', `${configName}.json`);
      if (fs.existsSync(p)) return p;
    }
    // Detecta automaticamente: pega o primeiro config da pasta (exceto template)
    const configDir = path.join(__dirname, '..', 'config');
    try {
      const files = fs.readdirSync(configDir).filter(f => f.endsWith('.json') && f !== 'template.json');
      if (files.length > 0) return path.join(configDir, files[0]);
    } catch {}
    return null;
  }
}

module.exports = { CVManager };
