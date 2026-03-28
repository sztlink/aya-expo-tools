/**
 * set-fans.js — Configura fan speed via MSI Afterburner profiles
 * uso: node set-fans.js <speed%|auto>
 * ex:  node set-fans.js 75    → força 75% em ambas GPUs
 *      node set-fans.js auto  → volta para automático
 */
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AB_DIR     = 'C:\\Program Files (x86)\\MSI Afterburner';
const AB_EXE     = path.join(AB_DIR, 'MSIAfterburner.exe');
const PROFILE_DIR = path.join(AB_DIR, 'Profiles');

const GPU_CFGS = fs.readdirSync(PROFILE_DIR)
  .filter(f => f.startsWith('VEN_10DE') && f.endsWith('.cfg'))
  .map(f => path.join(PROFILE_DIR, f));

const arg  = process.argv[2];
const auto = arg === 'auto';
const spd  = auto ? null : parseInt(arg);

if (!auto && (isNaN(spd) || spd < 20 || spd > 100)) {
  console.error('uso: node set-fans.js <20-100|auto>');
  process.exit(1);
}

console.log(auto ? 'Configurando fans: AUTO' : `Configurando fans: ${spd}%`);

for (const cfg of GPU_CFGS) {
  let content = fs.readFileSync(cfg, 'utf8');

  // Atualizar FanMode e FanSpeed no bloco [Startup]
  if (auto) {
    content = content
      .replace(/^FanMode=.*$/m,  'FanMode=')
      .replace(/^FanSpeed=.*$/m, 'FanSpeed=');
  } else {
    content = content
      .replace(/^FanMode=.*$/m,  'FanMode=1')    // 1 = manual
      .replace(/^FanSpeed=.*$/m, `FanSpeed=${spd}`);
  }

  fs.writeFileSync(cfg, content, 'utf8');
  console.log('  Escrito:', path.basename(cfg), auto ? '(auto)' : `FanMode=1 FanSpeed=${spd}`);
}

// Matar Afterburner se estiver rodando e reiniciar para aplicar
try {
  execSync('taskkill /f /im MSIAfterburner.exe 2>nul', { stdio: 'ignore' });
} catch {}

// Aguardar 1s e reiniciar minimizado
setTimeout(() => {
  try {
    execSync(`start "" /min "${AB_EXE}"`, { shell: true, stdio: 'ignore' });
    console.log('MSI Afterburner iniciado. Aguarde 5s e verifique nvidia-smi...');
  } catch(e) {
    console.error('Erro ao iniciar Afterburner:', e.message);
  }
}, 1000);
