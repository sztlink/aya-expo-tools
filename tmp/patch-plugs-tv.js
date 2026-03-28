const fs = require('fs')
const path = 'C:/aya-expo-tools/config/beleza-astral.json'
let raw = fs.readFileSync(path, 'utf8')
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)
const config = JSON.parse(raw)

// Fix plug 5 and 6 controls
const plug5 = config.smartplugs.find(p => p.id === 'plug-5')
const plug6 = config.smartplugs.find(p => p.id === 'plug-6')
if (plug5) { plug5.controls = 'TV-1'; console.log('plug-5: controls = TV-1') }
if (plug6) { plug6.controls = 'TV-2'; console.log('plug-6: controls = TV-2') }

// Fix corrupted controls strings
const fixes = {
  'plug-1': 'Projetores 1–2',
  'plug-2': 'Projetores 3–4',
  'plug-3': 'Projetores 5–6',
  'plug-4': 'Áudio',
}
for (const [id, label] of Object.entries(fixes)) {
  const p = config.smartplugs.find(p => p.id === id)
  if (p && p.controls !== label) {
    console.log(id + ': controls fixed -> ' + label)
    p.controls = label
  }
}

fs.writeFileSync(path, JSON.stringify(config, null, 2), 'utf8')
console.log('Config saved')
