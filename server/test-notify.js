// Test CV Notify manually
const cvNotify = require('./cv-notify');
const cvReport = require('./cv-report');
const path = require('path');
const fs = require('fs');

const configPath = path.join(__dirname, '..', 'config', 'beleza-astral.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Start cvReport to populate data
cvReport.start(null);

// Wait a bit for data to load, then send test report
setTimeout(async () => {
  try {
    console.log('[Test] Sending daily report...');
    cvNotify.start(cvReport, config);
    await cvNotify.sendDailyReport();
    console.log('[Test] Report sent successfully!');
    process.exit(0);
  } catch (e) {
    console.error('[Test] Error:', e.message);
    process.exit(1);
  }
}, 2000);
