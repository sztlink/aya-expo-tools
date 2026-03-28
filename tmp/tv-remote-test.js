const net = require('net')
const fs = require('fs')
const out = []

const s = new net.Socket()
s.setTimeout(3000)
s.on('data', d => out.push('RECV: ' + d.toString().slice(0, 300)))
s.on('connect', () => {
  out.push('Connected to 6466')
  // Try Hisense RemoteNow hello
  s.write(JSON.stringify({type:'hello'}) + '\n')
  setTimeout(() => {
    fs.writeFileSync('C:/aya-expo-tools/tmp/tv-remote.txt', out.join('\n'))
    s.destroy()
    process.exit(0)
  }, 2000)
})
s.on('error', e => { out.push('ERR: ' + e.message); fs.writeFileSync('C:/aya-expo-tools/tmp/tv-remote.txt', out.join('\n')); process.exit(1) })
s.on('timeout', () => { out.push('TIMEOUT'); fs.writeFileSync('C:/aya-expo-tools/tmp/tv-remote.txt', out.join('\n')); s.destroy(); process.exit(1) })
s.connect(6466, '192.168.0.202')
