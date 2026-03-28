const tls = require('tls')
const fs = require('fs')
const path = require('path')

const ip = '192.168.0.201'
const certDir = 'C:/aya-expo-tools/config/tv-certs/' + ip
const out = []
function log(msg) { out.push(msg); console.log(msg) }

// Connect WITHOUT cert first to see if TV prompts pairing
const sock = tls.connect({
  host: ip,
  port: 6466,
  rejectUnauthorized: false,
  cert: fs.readFileSync(path.join(certDir, 'client.crt')),
  key: fs.readFileSync(path.join(certDir, 'client.key')),
  timeout: 10000,
}, () => {
  log('TLS connected — sending auth request')
  // Try different auth formats
  sock.write(JSON.stringify({
    type: 'register',
    id: 'aya-expo-tools',
    payload: {
      forcePairing: false,
      pairingType: 'PROMPT',
      manifest: {
        appVersion: '1.0',
        manifestVersion: 1,
        permissions: ['CONTROL_POWER','CONTROL_INPUT_TV'],
        signed: {}
      },
      'client-key': ''
    }
  }) + '\n')
})

sock.on('data', d => {
  const str = d.toString()
  log('RECV: ' + str.slice(0, 500))
})

sock.on('error', e => log('ERR: ' + e.message))
sock.on('timeout', () => log('TIMEOUT'))

setTimeout(() => {
  fs.writeFileSync('C:/aya-expo-tools/tmp/tv-pair-result.txt', out.join('\n'))
  sock.destroy()
  process.exit(0)
}, 12000)
