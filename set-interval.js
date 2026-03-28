// set-interval.js — chamado com: node set-interval.js <valor>
// Ex: node set-interval.js 0.5
const fs  = require('fs');
const val = parseFloat(process.argv[2]);
if (isNaN(val) || val <= 0) { console.error('uso: node set-interval.js <segundos>'); process.exit(1); }

const CONFIG = 'C:\\aya-expo-tools\\config\\beleza-astral.json';
const cfg    = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
cfg.cv.interval = val;
fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2), 'utf8');
console.log('OK interval=' + val + ' (' + (1/val).toFixed(1) + 'fps)');
