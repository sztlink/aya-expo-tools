/**
 * safe-restart.js — Reinicia o servidor preservando estado do counter e reid
 *
 * 1. Lê count.json e reid/state.json atuais
 * 2. Salva como count-preserved.json e reid-preserved.json
 * 3. Mata processos
 * 4. cv.js escreve fresh-start (normal)
 * 5. counter.py e reid.py verificam preserved → restauram → deletam
 *
 * Uso: node safe-restart.js
 */
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CV_OUT   = 'C:\\aya-expo-tools\\cv\\output';
const COUNT    = path.join(CV_OUT, 'counter', 'count.json');
const COUNT_P  = path.join(CV_OUT, 'counter', 'count-preserved.json');
const REID     = path.join(CV_OUT, 'reid', 'state.json');
const REID_P   = path.join(CV_OUT, 'reid', 'reid-preserved.json');

// 1. Preservar counter
if (fs.existsSync(COUNT)) {
  const data = JSON.parse(fs.readFileSync(COUNT, 'utf8'));
  fs.writeFileSync(COUNT_P, JSON.stringify(data));
  console.log(`Counter preservado: entries=${data.entries} exits=${data.exits} date=${data.date}`);
} else {
  console.log('Counter: sem count.json para preservar');
}

// 2. Preservar reid
if (fs.existsSync(REID)) {
  const data = JSON.parse(fs.readFileSync(REID, 'utf8'));
  fs.writeFileSync(REID_P, JSON.stringify(data));
  console.log(`ReID preservado: uniqueVisitors=${data.today?.uniqueVisitors} staffCount=${data.today?.staffCount}`);
} else {
  console.log('ReID: sem state.json para preservar');
}

// 3. Matar processos
console.log('Matando processos...');
try {
  execSync('taskkill /f /im python.exe 2>nul', { stdio: 'ignore' });
} catch {}
try {
  execSync('taskkill /f /im node.exe 2>nul', { stdio: 'ignore' });
} catch {}

console.log('Aguardando 3s...');
setTimeout(() => {
  // 4. Iniciar via Task Scheduler
  try {
    execSync('schtasks /run /tn "AYA Expo Tools"', { stdio: 'inherit' });
    console.log('Servidor reiniciado com estado preservado.');
  } catch(e) {
    console.log('Erro ao iniciar:', e.message);
  }
}, 3000);
