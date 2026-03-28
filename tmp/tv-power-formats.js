const tls = require('tls')
const fs = require('fs')
const path = require('path')

const ip = process.argv[2] || '192.168.0.201'
const certDir = 'C:/aya-expo-tools/config/tv-certs/' + ip
const out = []

function log(msg) { out.push(msg); console.log(msg) }

const messages = [
  // Format 1: RemoteNow Button
  {type: 'Button', payload: {name: 'POWER', action: 'single'}},
  // Format 2: RemoteNow with key_code
  {type: 'remoteapp.input', payload: {key_code: 'POWER'}},
  // Format 3: VIDAA key event
  {type: 0, uri: 'ui.intent.action.KEY_POWER'},
  // Format 4: sendkey style  
  {type: 'sendkey', keyname: 'POWER'},
  // Format 5: request with button
  {request: 'button', body: {button: 'power'}},
  // Format 6: Hisense RemoteNow v2
  {action: 'sendkey', keycode: 'KEY_POWER'},
  // Format 7: CEC standby via Cast-like
  {type: 'STANDBY'},
]

const sock = tls.connect({
  host: ip,
  port: 6466,
  rejectUnauthorized: false,
  cert: fs.readFileSync(path.join(certDir, 'client.crt')),
  key: fs.readFileSync(path.join(certDir, 'client.key')),
  timeout: 8000,
}, () => {
  log('Connected')
  let i = 0
  function sendNext() {
    if (i >= messages.length) return
    const msg = JSON.stringify(messages[i])
    log('SEND[' + i + ']: ' + msg)
    sock.write(msg + '\n')
    i++
    setTimeout(sendNext, 1500)
  }
  sendNext()
})

sock.on('data', d => log('RECV: ' + d.toString().slice(0, 500)))
sock.on('error', e => log('ERR: ' + e.message))

setTimeout(() => {
  fs.writeFileSync('C:/aya-expo-tools/tmp/tv-power-formats.txt', out.join('\n'))
  sock.destroy()
  process.exit(0)
}, 15000)
