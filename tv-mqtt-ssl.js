// Test MQTT over SSL (TLS) on port 36669 — newer Hisense VIDAA models
const mqtt = require('mqtt');
const ip = process.argv[2] || '192.168.0.121';

console.log(`Testing MQTT+TLS on ${ip}:36669...`);

const client = mqtt.connect(`mqtts://${ip}:36669`, {
  username: 'hisenseservice',
  password: 'multimqttservice',
  connectTimeout: 8000,
  reconnectPeriod: 0,
  rejectUnauthorized: false,  // self-signed cert
});

const timeout = setTimeout(() => {
  console.log('Timeout — no response');
  client.end(true);
  process.exit(1);
}, 10000);

client.on('connect', () => {
  clearTimeout(timeout);
  console.log('CONNECTED via MQTT+TLS!');
  
  // Subscribe to device info
  const mac = 'e03ecbe2604c'; // tv-1 MAC lowercase no separators
  client.subscribe(`${mac}/remoteapp/tv/ui_service/data/#`, (err) => {
    if (err) console.log('Subscribe error:', err.message);
    else console.log('Subscribed to device topics');
  });

  // Request TV info
  const topic = `${mac}/remoteapp/tv/ui_service/data/gettvinfo`;
  client.publish(topic, '', {}, () => {
    console.log('Requested TV info...');
  });

  // Listen for 5s then disconnect
  setTimeout(() => {
    console.log('Done — disconnecting');
    client.end();
    process.exit(0);
  }, 5000);
});

client.on('message', (topic, message) => {
  console.log(`MSG [${topic}]: ${message.toString().slice(0, 200)}`);
});

client.on('error', (err) => {
  clearTimeout(timeout);
  console.log('Error:', err.message || err.code || err);
  client.end(true);
  process.exit(1);
});
