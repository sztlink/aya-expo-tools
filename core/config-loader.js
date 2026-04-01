// core/config-loader.js
const fs = require('fs');
const path = require('path');

function loadConfig(configName) {
  const configDir = path.join(__dirname, '..', 'config');
  const configPath = path.join(configDir, `${configName}.json`);

  if (!fs.existsSync(configPath)) {
    // Listar configs disponiveis
    const available = fs.readdirSync(configDir)
      .filter(f => f.endsWith('.json') && f !== 'template.json');
    return { valid: false, available, error: `Config not found: ${configName}` };
  }

  let raw = fs.readFileSync(configPath, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // BOM
  let config;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    return { valid: false, error: `JSON inválido em ${configName}.json: ${e.message}` };
  }
  config._name = configName;
  config._path = configPath;
  return { valid: true, config };
}

function getConfigName() {
  const arg = process.argv.find(a => a.startsWith('--config='));
  return arg ? arg.split('=')[1] : null; // null = nenhum config → wizard
}

module.exports = { loadConfig, getConfigName };
