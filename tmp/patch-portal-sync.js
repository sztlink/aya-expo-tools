const fs = require('fs');
const f = 'C:\\aya-expo-tools\\server\\portal-sync.js';
let code = fs.readFileSync(f, 'utf8');

// 1. Add audio require after cvReport require
if (!code.includes('_audio')) {
  code = code.replace(
    "const cvReport = require('./cv-report')",
    "const cvReport = require('./cv-report')\nlet _audio = null\ntry { _audio = require('./audio') } catch { /* audio opcional */ }"
  );
}

// 2. Add audio to payload after schedule line in _buildPayload
if (!code.includes('audio: _audio')) {
  code = code.replace(
    'schedule: this.scheduler ? this.scheduler.getStatus() : null,',
    'schedule: this.scheduler ? this.scheduler.getStatus() : null,\n      audio: _audio ? { level: _audio.getVolume(), muted: _audio.getVolume() === 0 } : null,'
  );
}

fs.writeFileSync(f, code, 'utf8');
console.log('OK - patched portal-sync.js with audio');
