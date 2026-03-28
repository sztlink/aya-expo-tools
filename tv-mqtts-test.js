// Test MQTT over TLS with client cert options on Hisense VIDAA
const mqtt = require('mqtt');
const tls = require('tls');
const ip = process.argv[2] || '192.168.0.121';

// Approach 1: mqtts:// (MQTT over TLS)
console.log(`[1] Testing mqtts://${ip}:36669 (standard TLS)...`);

const client1 = mqtt.connect(`mqtts://${ip}:36669`, {
  username: 'hisenseservice',
  password: 'multimqttservice',
  connectTimeout: 5000,
  reconnectPeriod: 0,
  rejectUnauthorized: false,
  protocolVersion: 4,
});

const t1 = setTimeout(() => {
  console.log('[1] Timeout');
  client1.end(true);
  tryWss();
}, 6000);

client1.on('connect', () => {
  clearTimeout(t1);
  console.log('[1] CONNECTED!');
  client1.end();
  process.exit(0);
});

client1.on('error', (err) => {
  clearTimeout(t1);
  console.log(`[1] Error: ${err.message || err.code}`);
  client1.end(true);
  tryWss();
});

// Approach 2: wss:// (MQTT over WebSocket over TLS — some VIDAA models)
function tryWss() {
  console.log(`\n[2] Testing wss://${ip}:8443 (MQTT over WebSocket)...`);
  
  const client2 = mqtt.connect(`wss://${ip}:8443`, {
    username: 'hisenseservice',
    password: 'multimqttservice',
    connectTimeout: 5000,
    reconnectPeriod: 0,
    rejectUnauthorized: false,
    protocolVersion: 4,
  });

  const t2 = setTimeout(() => {
    console.log('[2] Timeout');
    client2.end(true);
    tryRaw();
  }, 6000);

  client2.on('connect', () => {
    clearTimeout(t2);
    console.log('[2] CONNECTED via WSS!');
    client2.end();
    process.exit(0);
  });

  client2.on('error', (err) => {
    clearTimeout(t2);
    console.log(`[2] Error: ${err.message || err.code}`);
    client2.end(true);
    tryRaw();
  });
}

// Approach 3: Raw TLS socket to see what's actually listening
function tryRaw() {
  console.log(`\n[3] Raw TLS probe on ${ip}:36669...`);
  
  const socket = tls.connect({
    host: ip,
    port: 36669,
    rejectUnauthorized: false,
    timeout: 5000,
  }, () => {
    console.log('[3] TLS CONNECTED!');
    console.log(`    Protocol: ${socket.getProtocol()}`);
    console.log(`    Cipher: ${JSON.stringify(socket.getCipher())}`);
    const cert = socket.getPeerCertificate();
    if (cert) {
      console.log(`    Server CN: ${cert.subject?.CN || 'N/A'}`);
      console.log(`    Issuer: ${cert.issuer?.CN || 'N/A'}`);
    }
    socket.end();
    process.exit(0);
  });

  socket.on('error', (err) => {
    console.log(`[3] Error: ${err.message}`);
    
    console.log('\n[4] Raw TLS probe on port 8443...');
    const s2 = tls.connect({ host: ip, port: 8443, rejectUnauthorized: false, timeout: 5000 }, () => {
      console.log('[4] TLS CONNECTED on 8443!');
      console.log(`    Protocol: ${s2.getProtocol()}`);
      const cert = s2.getPeerCertificate();
      if (cert?.subject) console.log(`    Server CN: ${cert.subject.CN}`);
      if (cert?.issuer) console.log(`    Issuer: ${cert.issuer.CN}`);
      s2.end();
      process.exit(0);
    });
    s2.on('error', (e) => {
      console.log(`[4] Error: ${e.message}`);
      process.exit(1);
    });
  });

  socket.setTimeout(5000, () => {
    console.log('[3] Timeout');
    socket.destroy();
  });
}
