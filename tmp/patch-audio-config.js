/**
 * Patch: add audioVolume to schedule config in beleza-astral.json
 */
const fs = require('fs');
const f = 'C:\\aya-expo-tools\\config\\beleza-astral.json';
const config = JSON.parse(fs.readFileSync(f, 'utf8'));

if (config.schedule.audioVolume !== undefined) {
  console.log('SKIP - audioVolume already set:', config.schedule.audioVolume);
  process.exit(0);
}

config.schedule.audioVolume = 80;
fs.writeFileSync(f, JSON.stringify(config, null, 2), 'utf8');
console.log('OK - audioVolume set to 80 in schedule config');
