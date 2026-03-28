const fs = require('fs')
const path = 'C:/aya-expo-tools/config/beleza-astral.json'
let raw = fs.readFileSync(path, 'utf8')
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)
const config = JSON.parse(raw)

// Replace all plugs with only the 2 real ones
config.smartplugs = [
  {
    id: 'plug-tv1',
    name: 'Smart Plug TV-1',
    ip: '192.168.0.184',
    model: 'AVATTO WiFi Smart Socket Brazil 16A',
    controls: 'TV-1',
    deviceId: 'eb7a4ea2c370d73f91ymo5',
    productKey: 'keyjup78v54myhan',
    protocol: 'tuya',
    version: '3.4'
  },
  {
    id: 'plug-tv2',
    name: 'Smart Plug TV-2',
    ip: '192.168.0.126',
    model: 'AVATTO WiFi Smart Socket Brazil 16A',
    controls: 'TV-2',
    deviceId: 'eb9a38f4fa639284bcemvo',
    productKey: 'keyjup78v54myhan',
    protocol: 'tuya',
    version: '3.4'
  }
]

fs.writeFileSync(path, JSON.stringify(config, null, 2), 'utf8')
console.log('Config updated: 2 real plugs, phantoms removed')
console.log(JSON.stringify(config.smartplugs, null, 2))
