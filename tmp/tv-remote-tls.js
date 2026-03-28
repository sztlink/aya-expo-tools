const tls = require('tls')
const fs = require('fs')
const out = []

const s = tls.connect({
  host: '192.168.0.202',
  port: 6466,
  rejectUnauthorized: false,
  timeout: 3000
}, () => {
  out.push('TLS connected to 6466')
  // Hisense RemoteNow auth message
  const auth = JSON.stringify({
    type: 'AuthReq',
    payload: { appId: 'aya-expo', appName: 'AYA Expo Tools' }
  })
  s.write(auth + '\n')
})

s.on('data', d => out.push('RECV: ' + d.toString().slice(0, 500)))
s.on('error', e => out.push('ERR: ' + e.message))
s.on('timeout', () => out.push('TIMEOUT'))

setTimeout(() => {
  fs.writeFileSync('C:/aya-expo-tools/tmp/tv-remote-tls.txt', out.join('\n'))
  s.destroy()
  process.exit(0)
}, 4000)
