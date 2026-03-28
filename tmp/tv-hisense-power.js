const tls = require('tls')
const fs = require('fs')
const path = require('path')

const ip = process.argv[2] || '192.168.0.202'
const certDir = 'C:/aya-expo-tools/config/tv-certs/' + ip
const out = []

function log(msg) { out.push(msg); console.log(msg) }

const sock = tls.connect({
  host: ip,
  port: 6466,
  rejectUnauthorized: false,
  cert: fs.readFileSync(path.join(certDir, 'client.crt')),
  key: fs.readFileSync(path.join(certDir, 'client.key')),
  timeout: 5000,
}, () => {
  log('TLS connected')
  
  // Try multiple message formats used by different Hisense protocols
  const messages = [
    // Format 1: hisensetv style
    JSON.stringify({type: 'AuthReq'}) + '\n',
    // Format 2: VIDAA key event
    JSON.stringify({type: 0, uri: 'ui.intent.action.KEY_POWER'}) + '\n',
    // Format 3: RemoteNow button
    JSON.stringify({type: 'Button', payload: {name: 'POWER', action: 'single'}}) + '\n',
  ]
  
  let i = 0
  function sendNext() {
    if (i >= messages.length) return
    log('SEND[' + i + ']: ' + messages[i].trim())
    sock.write(messages[i])
    i++
    setTimeout(sendNext, 1500)
  }
  sendNext()
})

sock.on('data', d => log('RECV: ' + d.toString().slice(0, 500)))
sock.on('error', e => log('ERR: ' + e.message))
sock.on('timeout', () => log('TIMEOUT'))

setTimeout(() => {
  fs.writeFileSync('C:/aya-expo-tools/tmp/tv-power-test.txt', out.join('\n'))
  sock.destroy()
  process.exit(0)
}, 8000)
