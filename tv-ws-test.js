// Test Hisense RemoteNow WebSocket API on port 8443
const https = require('https');
const WebSocket = require('ws');
const ip = process.argv[2] || '192.168.0.121';

// Try WebSocket connection (Hisense RemoteNow protocol)
console.log(`Testing WebSocket wss://${ip}:8443/...`);

const ws = new WebSocket(`wss://${ip}:8443/`, {
  rejectUnauthorized: false,
  headers: {
    'Origin': `https://${ip}:8443`,
  },
});

const timeout = setTimeout(() => {
  console.log('Timeout — closing');
  ws.close();
  process.exit(1);
}, 8000);

ws.on('open', () => {
  console.log('WebSocket CONNECTED!');
  
  // Try sending authentication/pairing request
  const authMsg = JSON.stringify({
    type: 'cycada:authentication',
    data: {
      app_name: 'AYA Expo Tools',
      app_id: 'aya.expo.tools',
      device_name: 'AYA Media Server',
      device_id: 'aya-mediaserver-ba',
    }
  });
  console.log('Sending auth request...');
  ws.send(authMsg);
});

ws.on('message', (data) => {
  clearTimeout(timeout);
  console.log('MSG:', data.toString().slice(0, 500));
});

ws.on('error', (err) => {
  clearTimeout(timeout);
  console.log('WS Error:', err.message);
  
  // Fallback: try plain HTTP endpoints
  console.log('\nTrying HTTPS endpoints...');
  const paths = [
    '/api/interface/getdeviceid',
    '/api/interface/devicename',
    '/api/interface/closedcaption',
    '/platform',
    '/device',
  ];
  
  let pending = paths.length;
  paths.forEach(p => {
    const req = https.get(`https://${ip}:8443${p}`, { rejectUnauthorized: false }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        console.log(`  ${p} → ${res.statusCode} ${body.slice(0, 200)}`);
        if (--pending === 0) process.exit(0);
      });
    });
    req.on('error', (e) => {
      console.log(`  ${p} → Error: ${e.message}`);
      if (--pending === 0) process.exit(0);
    });
    req.setTimeout(3000);
  });
});

ws.on('close', () => {
  clearTimeout(timeout);
  console.log('WebSocket closed');
});
