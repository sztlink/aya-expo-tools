'use strict';

const path = require('path');
const { loadConfig, getConfigName } = require('./core/config-loader');

// ── Load config (optional in setup mode) ───────────────────
const configName = getConfigName();
const setupMode = !configName;

let config = null;
if (!setupMode) {
  const result = loadConfig(configName);
  if (!result.valid) {
    console.error(`Config error: ${result.error}`);
    if (result.available) console.error('Available:', result.available.join(', '));
    process.exit(1);
  }
  config = result.config;
}

if (setupMode) {
  console.log('\n  ◇ aya-expo-tools v2 — Setup Mode');
  console.log('  No config specified. Starting setup wizard...');
  console.log('  Visit http://localhost:3000/#/setup to configure.');
} else {
  console.log(`\n  ◇ aya-expo-tools v2 — ${config.exhibition?.name || configName}`);
}

// ── Core ───────────────────────────────────────────────────
const core = require('./core/server');
const { app, server } = core.createApp(config);

// ── Setup routes (always available, even without config) ───
require('./core/routes/setup')(app);

if (setupMode) {
  // Setup mode: serve only the wizard UI
  console.log('  Setup routes loaded.');
  core.start(config, { app, server });
} else {
  // Normal mode: register all clusters and routes
  
  // ── Register clusters ────────────────────────────────────
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

  // ── Scheduler ────────────────────────────────────────────
  const { Scheduler } = require('./core/scheduler');
  const scheduler = new Scheduler(config, clusters, {
    addLogEntry: core.addLogEntry,
    broadcast: core.broadcast
  });

  // ── Core routes ──────────────────────────────────────────
  require('./core/routes/session')(app, {
    session: core.session,
    addLogEntry: core.addLogEntry,
    readLog: core.readLog,
    writeLog: core.writeLog,
    broadcast: core.broadcast,
  });
  require('./core/routes/config')(app, {
    config,
    configName,
    configPath: config._path,
    projectors: clusters.equipment?.projectors || null,
    cameras: clusters.cameras?.cameras || null,
    scheduler,
    cvManager: clusters.cv?.cvManager || null,
  });
  const network = require('./core/network');
  const serverHealth = require('./core/server-health');

  if (clusters.communication?.portalSync) {
    clusters.communication.portalSync.scheduler = scheduler;
    clusters.communication.portalSync.readLog = core.readLog;
    clusters.communication.portalSync.session = core.session;
    clusters.communication.portalSync.serverHealth = serverHealth;
  }

  require('./core/routes/health')(app, {
    config,
    network,
    serverHealth,
    cvManager: clusters.cv?.cvManager || null,
    projectors: clusters.equipment?.projectors || null,
    cameras: clusters.cameras?.cameras || null,
    scheduler
  });
  require('./core/routes/schedule')(app, { scheduler });
  require('./core/routes/archive')(app, config);

  // ── Start ────────────────────────────────────────────────
  core.start(config, { app, server }, {
    projectors: clusters.equipment?.projectors || null,
    cameras: clusters.cameras?.cameras || null,
    scheduler,
    portalSync: clusters.communication?.portalSync || null,
    cvManager: clusters.cv?.cvManager || null,
    cvLogger: clusters.data?.cvLogger || null,
    serverHealth,
    timelapse: clusters.cameras?.timelapse || null,
  });
}
