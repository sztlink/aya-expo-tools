const dgram = require('dgram')
const crypto = require('crypto')
const fs = require('fs')

const out = []
function log(msg) { out.push(msg); console.log(msg) }

// Tuya devices broadcast on UDP 6666 (plaintext) and 6667 (encrypted)
const sock6666 = dgram.createSocket({ type: 'udp4', reuseAddr: true })
const sock6667 = dgram.createSocket({ type: 'udp4', reuseAddr: true })

// Tuya default key for UDP discovery
const TUYA_KEY = Buffer.from('6c1ec8e2bb9bb59ab50b0daf649b410a', 'hex')

function decryptUDP(data) {
  try {
    // Skip header (20 bytes) and footer (8 bytes)
    const payload = data.slice(20, data.length - 8)
    const decipher = crypto.createDecipheriv('aes-128-ecb', TUYA_KEY, null)
    let dec = decipher.update(payload)
    dec = Buffer.concat([dec, decipher.final()])
    return dec.toString('utf8')
  } catch {
    return null
  }
}

sock6666.on('message', (msg, rinfo) => {
  try {
    // Plaintext broadcast
    const payload = msg.slice(20, msg.length - 8)
    const text = payload.toString('utf8')
    log('UDP:6666 from ' + rinfo.address + ': ' + text.slice(0, 300))
  } catch (e) {
    log('UDP:6666 from ' + rinfo.address + ': (parse error)')
  }
})

sock6667.on('message', (msg, rinfo) => {
  const dec = decryptUDP(msg)
  if (dec) {
    log('UDP:6667 from ' + rinfo.address + ': ' + dec.slice(0, 300))
  } else {
    log('UDP:6667 from ' + rinfo.address + ': (encrypted, ' + msg.length + ' bytes)')
  }
})

sock6666.bind(6666, '0.0.0.0', () => { sock6666.setBroadcast(true); log('Listening on UDP 6666...') })
sock6667.bind(6667, '0.0.0.0', () => { sock6667.setBroadcast(true); log('Listening on UDP 6667...') })

// Also try sending a Tuya discovery probe
setTimeout(() => {
  const probe = Buffer.alloc(20)
  probe.writeUInt32BE(0x000055AA, 0)  // Tuya header
  const bcast = dgram.createSocket('udp4')
  bcast.bind(() => {
    bcast.setBroadcast(true)
    bcast.send(probe, 0, probe.length, 6666, '255.255.255.255')
    bcast.send(probe, 0, probe.length, 6667, '255.255.255.255')
    log('Discovery probe sent')
  })
}, 1000)

setTimeout(() => {
  fs.writeFileSync('C:/aya-expo-tools/tmp/tuya-discover.txt', out.join('\n'))
  sock6666.close()
  sock6667.close()
  process.exit(0)
}, 10000)
