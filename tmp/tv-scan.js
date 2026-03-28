const net = require('net')
const fs = require('fs')
const ports = [8008,8009,8443,36669,36670,4443,55000,1925,6466,7000,9090,15600]
const tvs = [['TV-1','192.168.0.202'],['TV-2','192.168.0.201']]
const out = []

async function scan(name, ip) {
  for (const port of ports) {
    const ok = await new Promise(r => {
      const s = new net.Socket()
      s.setTimeout(1000)
      s.on('connect', () => { s.destroy(); r(true) })
      s.on('timeout', () => { s.destroy(); r(false) })
      s.on('error', () => { r(false) })
      s.connect(port, ip)
    })
    if (ok) out.push(name + ' :' + port + ' OPEN')
  }
}

;(async () => {
  for (const [name, ip] of tvs) await scan(name, ip)
  fs.writeFileSync('C:/aya-expo-tools/tmp/tv-ports.txt', out.join('\n'))
  console.log(out.join('\n'))
  process.exit(0)
})()
