// Discover Google Cast / DLNA / SSDP services on the Hisense TVs
const dgram = require('dgram');
const http = require('http');
const https = require('https');

const tvIps = ['192.168.0.121', '192.168.0.210'];

// === 1. SSDP Discovery (UPnP/DLNA) ===
console.log('=== SSDP Discovery (multicast) ===');
const ssdp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
const SSDP_ADDR = '239.255.255.250';
const SSDP_PORT = 1900;
const searchMsg = Buffer.from(
  'M-SEARCH * HTTP/1.1\r\n' +
  `HOST: ${SSDP_ADDR}:${SSDP_PORT}\r\n` +
  'MAN: "ssdp:discover"\r\n' +
  'MX: 3\r\n' +
  'ST: ssdp:all\r\n\r\n'
);

const found = new Set();
ssdp.on('message', (msg, rinfo) => {
  // Only care about our TVs
  if (tvIps.includes(rinfo.address)) {
    const key = `${rinfo.address}:${rinfo.port}`;
    if (!found.has(key)) {
      found.add(key);
      const lines = msg.toString().split('\r\n');
      const st = lines.find(l => l.toLowerCase().startsWith('st:'));
      const location = lines.find(l => l.toLowerCase().startsWith('location:'));
      const server = lines.find(l => l.toLowerCase().startsWith('server:'));
      console.log(`\n[SSDP] ${rinfo.address}:`);
      if (st) console.log(`  ${st}`);
      if (location) console.log(`  ${location}`);
      if (server) console.log(`  ${server}`);
    }
  }
});

ssdp.bind(() => {
  ssdp.addMembership(SSDP_ADDR);
  ssdp.send(searchMsg, 0, searchMsg.length, SSDP_PORT, SSDP_ADDR);
  // Send again after 1s
  setTimeout(() => ssdp.send(searchMsg, 0, searchMsg.length, SSDP_PORT, SSDP_ADDR), 1000);
});

// === 2. Direct port probes for Cast/DLNA ===
setTimeout(async () => {
  console.log('\n=== Direct port probes ===');
  const ports = [
    { port: 8008, name: 'Google Cast HTTP' },
    { port: 8009, name: 'Google Cast TLS' },
    { port: 8443, name: 'HTTPS (Cast?)' },
    { port: 9080, name: 'DLNA alt' },
    { port: 7000, name: 'AirPlay' },
    { port: 49152, name: 'UPnP/DLNA' },
    { port: 1900, name: 'SSDP' },
  ];

  for (const ip of tvIps) {
    console.log(`\n--- ${ip} ---`);
    for (const { port, name } of ports) {
      const open = await new Promise(resolve => {
        const s = new (require('net').Socket)();
        s.setTimeout(2000);
        s.connect(port, ip, () => { s.destroy(); resolve(true); });
        s.on('error', () => resolve(false));
        s.on('timeout', () => { s.destroy(); resolve(false); });
      });
      if (open) console.log(`  ${port} (${name}): OPEN`);
    }
  }

  // === 3. Try Cast HTTP API on 8008 ===
  for (const ip of tvIps) {
    for (const port of [8008, 8443]) {
      const proto = port === 8443 ? https : http;
      const opts = port === 8443 ? { rejectUnauthorized: false } : {};
      try {
        const body = await new Promise((resolve, reject) => {
          const req = proto.get(`${port === 8443 ? 'https' : 'http'}://${ip}:${port}/setup/eureka_info`, opts, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(d));
          });
          req.on('error', reject);
          req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
        });
        console.log(`\n[Cast API] ${ip}:${port}/setup/eureka_info:`);
        console.log(body.slice(0, 500));
      } catch (e) {
        // silent
      }
    }
  }

  setTimeout(() => { ssdp.close(); process.exit(0); }, 1000);
}, 5000);

// Timeout
setTimeout(() => { ssdp.close(); process.exit(0); }, 12000);
