'use strict';

const path = require('path');
const { loadConfig, getConfigName } = require('./core/config-loader');

// ── Load config ────────────────────────────────────────────
const configName = getConfigName();
if (!configName) {
  console.log('\n  ◇ aya-expo-tools v2');
  console.log('  No config specified. Run with --config=<name>');
  console.log('  Available configs:');
  const { loadConfig: lc } = require('./core/config-loader');
  const check = lc('__nonexistent__');
  if (check.available) check.available.forEach(c => console.log(`    - ${c}`));
  // TODO Sprint 5: start server with /setup wizard
  process.exit(1);
}

const result = loadConfig(configName);
if (!result.valid) {
  console.error(`Config error: ${result.error}`);
  if (result.available) console.error('Available:', result.available.join(', '));
  process.exit(1);
}

const config = result.config;
console.log(`\n  ◇ aya-expo-tools v2 — ${config.expo?.name || configName}`);

// ── Core ───────────────────────────────────────────────────
const core = require('./core/server');
const { app, server } = core.createApp(config);

// ── Register clusters ──────────────────────────────────────
const clusters = {};

// Always load
clusters.equipment = require('./clusters/equipment');
clusters.cameras = require('./clusters/cameras');

// Conditional
if (config.cv?.enabled !== false) {
  clusters.cv = require('./clusters/cv');
  clusters.data = require('./clusters/data');
}

if (config.modules?.portal?.enabled !== false) {
  clusters.communication = require('./clusters/communication');
}

// Register all
for (const [name, cluster] of Object.entries(clusters)) {
  console.log(`  Loading ${cluster.name}...`);
  cluster.register(app, config, clusters);
}

// ── Core routes ────────────────────────────────────────────
require('./core/routes/session')(app, { session: core.session, addLogEntry: core.addLogEntry });
require('./core/routes/config')(app, config);
require('./core/routes/health')(app, core);

// ── Start ──────────────────────────────────────────────────
core.start(config, { app, server });
