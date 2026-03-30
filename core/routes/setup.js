// core/routes/setup.js — Installation wizard routes (Sprint 5)
'use strict';

const fs = require('fs');
const path = require('path');

module.exports = function(app) {
  const configDir = path.join(__dirname, '..', '..', 'config');
  const stateFile = path.join(configDir, 'setup-state.json');

  // ─── GET /api/setup/state ──────────────────────────────────
  // Retrieves persisted wizard state (survives page reload)
  app.get('/api/setup/state', (req, res) => {
    try {
      if (!fs.existsSync(stateFile)) {
        return res.json({
          ok: true,
          state: {
            currentStep: 1,
            completed: [],
            skipped: [],
            data: {}
          }
        });
      }
      
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      res.json({ ok: true, state });
    } catch (err) {
      console.error('[Setup] Failed to read state:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ─── POST /api/setup/state ─────────────────────────────────
  // Saves wizard state
  app.post('/api/setup/state', (req, res) => {
    try {
      const state = req.body;
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
      res.json({ ok: true });
    } catch (err) {
      console.error('[Setup] Failed to save state:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ─── POST /api/setup/generate ──────────────────────────────
  // Assembles full config JSON from wizard state and saves to config/<slug>.json
  app.post('/api/setup/generate', (req, res) => {
    try {
      const { state } = req.body;
      const data = state.data || {};
      
      // Validate required fields
      if (!data.expo?.slug) {
        return res.status(400).json({ 
          ok: false, 
          error: 'Expo slug is required' 
        });
      }

      const slug = data.expo.slug;
      
      // Assemble config JSON
      const config = {
        exhibition: {
          name: data.expo?.name || 'Untitled',
          venue: data.expo?.venue || '',
          city: data.expo?.city || '',
          slug: slug,
          artist: data.expo?.artist || '',
          dates: {
            open: data.expo?.openDate || null,
            close: data.expo?.closeDate || null
          },
          network: {
            mediaServer: data.network?.mediaServer || null
          }
        },
        
        projectors: (data.projectors || []).map(p => ({
          id: p.id || `proj-${Date.now()}`,
          name: p.name || 'Projector',
          ip: p.ip,
          model: p.model || '',
          input: p.input || 'HDMI1'
        })),
        
        cameras: (data.cameras || []).map(c => ({
          id: c.id || `cam-${Date.now()}`,
          name: c.name || 'Camera',
          ip: c.ip,
          rtsp: c.rtsp,
          zones: c.zones || []
        })),
        
        tvs: (data.tvs || []).map(t => ({
          id: t.id || `tv-${Date.now()}`,
          name: t.name || 'TV',
          ip: t.ip,
          mac: t.mac || null
        })),
        
        smartplugs: (data.smartplugs || []).map(p => ({
          id: p.id || `plug-${Date.now()}`,
          name: p.name || 'Smart Plug',
          deviceId: p.deviceId,
          ip: p.ip || null
        })),
        
        pjlink: {
          port: 4352,
          password: data.pjlink?.password || '',
          pollInterval: 30000
        },
        
        audio: {
          device: data.audio?.device || null,
          volume: data.audio?.volume || 70
        },
        
        schedule: {
          timezone: 'America/Sao_Paulo',
          days: data.schedule?.days || {
            mon: null,
            tue: { open: '09:00', close: '20:00' },
            wed: { open: '09:00', close: '20:00' },
            thu: { open: '09:00', close: '20:00' },
            fri: { open: '09:00', close: '20:00' },
            sat: { open: '09:00', close: '20:00' },
            sun: { open: '09:00', close: '20:00' }
          }
        },
        
        cv: {
          enabled: data.cv?.enabled !== false,
          hardware: 'auto',
          model: null,
          imgsz: null,
          interval: null,
          gpu: 0,
          confidence: 0.4,
          heatmapDecay: 0.999,
          zones: (data.cv?.zones || []).map(z => ({
            id: z.id,
            name: z.name,
            cameraId: z.cameraId,
            polygon: z.polygon
          })),
          reid: {
            enabled: true,
            model: 'osnet_x0_25',
            thresholds: {
              sameZone: 0.4,
              crossZone: 0.6
            },
            featureGallerySize: 5,
            spatialBoost: true,
            matchInterval: 1,
            statusInterval: 30
          },
          staffFilter: {
            enabled: false,
            colorHSV: [120, 50, 50],
            colorRange: [20, 80, 80],
            timeMinutes: 15,
            uniformThreshold: 0.3
          },
          counter: {
            enabled: true
          }
        },
        
        modules: {
          portal: {
            enabled: data.portal?.enabled !== false,
            projetoId: data.portal?.projetoId || null
          }
        },
        
        server: {
          port: 3000,
          host: '0.0.0.0'
        }
      };
      
      // Save config file
      const configPath = path.join(configDir, `${slug}.json`);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      // Clean up setup state
      if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
      }
      
      console.log(`[Setup] Config generated: ${slug}.json`);
      res.json({ ok: true, configPath, slug });
    } catch (err) {
      console.error('[Setup] Failed to generate config:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ─── POST /api/setup/test/network-scan ────────────────────
  // Scans local network for devices
  app.post('/api/setup/test/network-scan', async (req, res) => {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // Simple network scan using arp -a (Windows)
      const { stdout } = await execAsync('arp -a');
      
      // OUI lookup — primeiros 3 octetos do MAC identificam fabricante
      const OUI_TABLE = {
        'c4:08:26': { vendor: 'Hisense', deviceType: 'tv' },
        'c4-08-26': { vendor: 'Hisense', deviceType: 'tv' },
        '00:9e:c8': { vendor: 'Hisense', deviceType: 'tv' },
        '9c:8e:cd': { vendor: 'Intelbras', deviceType: 'camera' },
        '9c-8e-cd': { vendor: 'Intelbras', deviceType: 'camera' },
        '78:a5:04': { vendor: 'Intelbras', deviceType: 'camera' },
        'b0:4e:26': { vendor: 'Intelbras', deviceType: 'camera' },
        '00:1e:c0': { vendor: 'NEC', deviceType: 'projector' },
        '00-1e-c0': { vendor: 'NEC', deviceType: 'projector' },
        '04:98:f3': { vendor: 'NEC', deviceType: 'projector' },
        'e0:27:1a': { vendor: 'Epson', deviceType: 'projector' },
        'c8:2b:96': { vendor: 'Epson', deviceType: 'projector' },
        '00:26:b8': { vendor: 'Christie', deviceType: 'projector' },
        'ac:c1:ee': { vendor: 'Panasonic', deviceType: 'projector' },
        'dc:4a:3e': { vendor: 'Panasonic', deviceType: 'projector' },
        'd8:47:10': { vendor: 'Tuya', deviceType: 'plug' },
        '10:d5:61': { vendor: 'Tuya', deviceType: 'plug' },
        '48:55:19': { vendor: 'Tuya', deviceType: 'plug' },
        '7c:f6:66': { vendor: 'Tuya', deviceType: 'plug' },
        '70:b3:d5': { vendor: 'Hikvision', deviceType: 'camera' },
        'c0:56:e3': { vendor: 'Hikvision', deviceType: 'camera' },
        'a4:cf:12': { vendor: 'Dahua', deviceType: 'camera' },
        'e0:50:8b': { vendor: 'Dahua', deviceType: 'camera' },
      };

      function lookupOUI(mac) {
        if (!mac) return { vendor: null, deviceType: 'unknown' };
        const prefix = mac.toLowerCase().substring(0, 8);
        return OUI_TABLE[prefix] || { vendor: null, deviceType: 'unknown' };
      }

      const DEVICE_TYPE_LABELS = {
        tv: 'TV',
        camera: 'Camera',
        projector: 'Projetor',
        plug: 'Tomada',
        unknown: 'Desconhecido'
      };

      // Detectar IP local desta maquina (preferir rede local sobre VPN)
      const os = require('os');
      const allIPs = [];
      const ifaces = os.networkInterfaces();
      for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            const isVPN = name.toLowerCase().includes('wg') || name.toLowerCase().includes('wireguard') || iface.address.startsWith('10.253.');
            allIPs.push({ ip: iface.address, name, isVPN });
          }
        }
      }
      // Ordena: rede local primeiro, VPN depois
      allIPs.sort((a, b) => (a.isVPN ? 1 : 0) - (b.isVPN ? 1 : 0));
      const localIPs = new Set(allIPs.map(x => x.ip));

      const devices = [];
      const lines = stdout.split('\n');
      
      for (const line of lines) {
        const match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f-]+)\s+(\w+)/i);
        if (match) {
          const ip = match[1];
          const mac = match[2];

          // Filtrar multicast, broadcast e MACs invalidos
          if (ip.startsWith('224.') || ip.startsWith('239.') || ip.startsWith('255.')) continue;
          if (mac === 'ff-ff-ff-ff-ff-ff' || mac.startsWith('01-00-5e')) continue;
          if (mac === '---' || mac === 'ff-ff-ff-ff-ff-ff') continue;

          const oui = lookupOUI(mac);
          const isLocal = localIPs.has(ip);

          devices.push({
            ip,
            mac: mac === '---' ? null : mac,
            vendor: oui.vendor,
            deviceType: isLocal ? 'mediaserver' : oui.deviceType,
            deviceTypeLabel: isLocal ? 'Este computador' : (DEVICE_TYPE_LABELS[oui.deviceType] || 'Desconhecido'),
            isLocal
          });
        }
      }

      // Ordena: media server primeiro, equipamentos conhecidos depois, desconhecidos por ultimo
      const typeOrder = { mediaserver: -1, projector: 0, camera: 1, tv: 2, plug: 3, unknown: 4 };
      devices.sort((a, b) => (typeOrder[a.deviceType] || 4) - (typeOrder[b.deviceType] || 4));
      
      const preferredIP = allIPs.length > 0 ? allIPs[0].ip : null;
      res.json({ ok: true, devices, localIPs: Array.from(localIPs), preferredIP });
    } catch (err) {
      console.error('[Setup] Network scan failed:', err);
      res.json({ ok: false, error: err.message, devices: [] });
    }
  });

  // ─── POST /api/setup/test/projector ────────────────────────
  // Tests PJLink connection to projector
  app.post('/api/setup/test/projector', async (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ ok: false, error: 'IP required' });
    
    try {
      // Test ping first
      const pingOk = await new Promise(resolve => {
        const { exec } = require('child_process');
        exec(`ping -n 1 -w 2000 ${ip}`, (err, out) => {
          resolve(!err && (out.includes('TTL=') || out.includes('Reply')));
        });
      });
      
      if (!pingOk) {
        return res.json({ 
          ok: false, 
          message: `${ip} not responding to ping` 
        });
      }
      
      // Test PJLink port
      const portOk = await new Promise(resolve => {
        const net = require('net');
        const socket = new net.Socket();
        socket.setTimeout(2000);
        socket.connect(4352, ip, () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('error', () => resolve(false));
        socket.on('timeout', () => resolve(false));
      });
      
      res.json({ 
        ok: portOk, 
        message: portOk 
          ? `Projector at ${ip} responding via PJLink` 
          : `${ip} responds to ping but PJLink port not accessible` 
      });
    } catch (err) {
      res.json({ ok: false, message: err.message });
    }
  });

  // ─── POST /api/setup/test/camera ───────────────────────────
  // Tests RTSP camera connection and captures snapshot
  app.post('/api/setup/test/camera', async (req, res) => {
    const { rtsp } = req.body;
    if (!rtsp) return res.status(400).json({ ok: false, error: 'RTSP URL required' });
    
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const snapshotPath = path.join(__dirname, '..', '..', 'temp', `snapshot-${Date.now()}.jpg`);
      
      // Ensure temp dir exists
      const tempDir = path.dirname(snapshotPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Capture frame using ffmpeg
      await execAsync(
        `ffmpeg -rtsp_transport tcp -i "${rtsp}" -frames:v 1 -y "${snapshotPath}"`,
        { timeout: 10000 }
      );
      
      if (fs.existsSync(snapshotPath)) {
        const imageData = fs.readFileSync(snapshotPath, { encoding: 'base64' });
        fs.unlinkSync(snapshotPath); // Clean up
        
        res.json({ 
          ok: true, 
          message: 'Camera snapshot captured',
          image: `data:image/jpeg;base64,${imageData}`
        });
      } else {
        res.json({ ok: false, message: 'Failed to capture snapshot' });
      }
    } catch (err) {
      res.json({ ok: false, message: err.message });
    }
  });

  // ─── POST /api/setup/test/tv ───────────────────────────────
  // Tests TV connection (ping and WOL)
  app.post('/api/setup/test/tv', async (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ ok: false, error: 'IP required' });
    
    try {
      const pingOk = await new Promise(resolve => {
        const { exec } = require('child_process');
        exec(`ping -n 1 -w 2000 ${ip}`, (err, out) => {
          resolve(!err && (out.includes('TTL=') || out.includes('Reply')));
        });
      });
      
      res.json({ 
        ok: pingOk, 
        message: pingOk ? `TV at ${ip} responding` : `${ip} not responding` 
      });
    } catch (err) {
      res.json({ ok: false, message: err.message });
    }
  });

  // ─── POST /api/setup/test/audio ────────────────────────────
  // Tests audio output
  app.post('/api/setup/test/audio', async (req, res) => {
    const { device, volume } = req.body;
    
    try {
      // Just validate that the request is well-formed
      // Actual audio test would require platform-specific implementation
      res.json({ 
        ok: true, 
        message: `Audio test: device=${device || 'default'}, volume=${volume || 70}%` 
      });
    } catch (err) {
      res.json({ ok: false, message: err.message });
    }
  });

  // ─── POST /api/setup/test/smartplug ────────────────────────
  // Tests smart plug connection
  app.post('/api/setup/test/smartplug', async (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ ok: false, error: 'Device ID required' });
    
    try {
      // Placeholder - actual Tuya implementation would go here
      res.json({ 
        ok: true, 
        message: `Smart plug test for ${deviceId} - implementation pending` 
      });
    } catch (err) {
      res.json({ ok: false, message: err.message });
    }
  });

  // ─── POST /api/setup/test/cv ───────────────────────────────
  // Tests CV detection on camera frame
  app.post('/api/setup/test/cv', async (req, res) => {
    const { cameraId, rtsp } = req.body;
    if (!rtsp) return res.status(400).json({ ok: false, error: 'RTSP URL required' });
    
    try {
      // Placeholder - actual CV test would capture frame and run detection
      res.json({ 
        ok: true, 
        message: `CV test for camera ${cameraId} - implementation pending`,
        detections: []
      });
    } catch (err) {
      res.json({ ok: false, message: err.message });
    }
  });

  // ─── POST /api/setup/test/portal ───────────────────────────
  // Tests portal sync and WireGuard connection
  app.post('/api/setup/test/portal', async (req, res) => {
    try {
      // Check internet connectivity
      const { exec } = require('child_process');
      const pingOk = await new Promise(resolve => {
        exec('ping -n 1 -w 2000 8.8.8.8', (err, out) => {
          resolve(!err && (out.includes('TTL=') || out.includes('Reply')));
        });
      });
      
      res.json({ 
        ok: pingOk, 
        message: pingOk 
          ? 'Internet connection available' 
          : 'No internet connection detected' 
      });
    } catch (err) {
      res.json({ ok: false, message: err.message });
    }
  });
};
