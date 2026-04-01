/**
 * AYA Expo Tools — Exhibition Data Archiver
 *
 * Archives exhibition data to external SSD with structured folders:
 *   <targetDrive>/<slug>/
 *     ├── timelapse/       — camera snapshots
 *     ├── logs/            — health, cv, equipment logs
 *     ├── cv/              — CV output data (heatmaps, tracks)
 *     ├── config/          — exhibition config backup
 *     └── reports/         — final report HTML
 *
 * Usage:
 *   const archiver = require('./archiver');
 *   const drives = await archiver.detectExternalDrives();
 *   const size = await archiver.calculateArchiveSize(config);
 *   await archiver.archive('E:', 'beleza-astral-2025', config, (progress) => { ... });
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Detect external drives (Windows) ────────────────────────────────
/**
 * Returns array of removable/external drives.
 * @returns {Promise<Array<{letter: string, label: string, freeGB: number}>>}
 */
async function detectExternalDrives() {
  // TODO: execSync bloqueia o event loop Node.js por 1-3s (wmic é lento no Windows).
  // Mover para worker thread ou execFile com callback em versão futura.
  try {
    // Use wmic to get drives: DriveType 2 = Removable, 3 = Local fixed
    const cmd = 'wmic logicaldisk get name,drivetype,volumename,freespace /format:csv';
    const output = execSync(cmd, { encoding: 'utf8' });

    const lines = output.trim().split('\n').slice(1).filter(Boolean); // skip header
    const drives = [];

    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length < 4) continue;

      // parts: [Node, DriveType, FreeSpace, Name, VolumeName]
      const driveType = parts[1];
      const freeSpace = parseInt(parts[2], 10) || 0;
      const letter = parts[3];
      const label = parts[4] || 'Unnamed';

      // DriveType: 2 = Removable, 3 = Local Fixed Disk
      // Exclude C: drive, include removable and other fixed drives
      if ((driveType === '2' || driveType === '3') && letter.toUpperCase() !== 'C:') {
        drives.push({
          letter: letter.replace(':', ''),
          label,
          freeGB: +(freeSpace / (1024 ** 3)).toFixed(2)
        });
      }
    }

    return drives;

  } catch (err) {
    console.error(`[Archiver] Failed to detect drives: ${err.message}`);
    return [];
  }
}

// ── Calculate archive size ──────────────────────────────────────────
/**
 * Calculates total size of all data to be archived.
 * @param {Object} config - Exhibition config
 * @returns {Promise<{totalMB: number, breakdown: Object}>}
 */
async function calculateArchiveSize(config) {
  const breakdown = {
    timelapse: 0,
    logs: 0,
    cv: 0,
    config: 0
  };

  function getDirSizeMB(dir) {
    if (!fs.existsSync(dir)) return 0;
    try {
      const cmd = process.platform === 'win32'
        ? `powershell -Command "(Get-ChildItem -Path '${dir}' -Recurse -File | Measure-Object -Property Length -Sum).Sum"`
        : `du -sb "${dir}" | cut -f1`;

      const output = execSync(cmd, { encoding: 'utf8' }).trim();
      const bytes = parseInt(output, 10) || 0;
      return +(bytes / (1024 ** 2)).toFixed(2);
    } catch (err) {
      console.error(`[Archiver] Failed to calculate size for ${dir}: ${err.message}`);
      return 0;
    }
  }

  // Timelapse (logs/timelapse/)
  breakdown.timelapse = getDirSizeMB(path.join(__dirname, '..', 'logs', 'timelapse'));

  // Health logs (logs/health/)
  breakdown.logs = getDirSizeMB(path.join(__dirname, '..', 'logs', 'health'));

  // CV data (clusters/cv/python/output/)
  if (config.cv?.enabled !== false) {
    breakdown.cv = getDirSizeMB(path.join(__dirname, '..', 'cv', 'python', 'output'));
  }

  // Config file
  breakdown.config = 0.001; // negligible

  const totalMB = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  return { totalMB: +totalMB.toFixed(2), breakdown };
}

// ── Copy directory recursively with progress ────────────────────────
function copyDirRecursive(src, dest, onProgress) {
  if (!fs.existsSync(src)) {
    console.warn(`[Archiver] Source not found: ${src}`);
    return;
  }

  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  let copied = 0;

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, onProgress);
    } else {
      fs.copyFileSync(srcPath, destPath);
      copied++;
      if (onProgress && copied % 10 === 0) {
        onProgress({ message: `Copying ${entry.name}...`, file: entry.name });
      }
    }
  }
}

// ── Generate final report HTML ──────────────────────────────────────
/**
 * Generates a standalone HTML report with exhibition summary.
 * @param {Object} config - Exhibition config
 * @param {string} slug - Exhibition slug
 * @param {string} outputPath - Where to save the HTML file
 */
function generateFinalReport(config, slug, outputPath) {
  const cvLogger = require('./cv-logger');
  const days = cvLogger.listDays();

  // Calculate stats from all available days
  let totalVisitors = 0;
  let peakDay = null;
  let peakCount = 0;
  let totalDwellMinutes = 0;
  let dwellSamples = 0;

  for (const day of days) {
    if (!day.hasSummary) continue;
    const summary = cvLogger.getDailySummary(day.date);
    if (!summary || !summary.counter) continue;

    const entries = summary.counter.entries || 0;
    totalVisitors += entries;

    if (entries > peakCount) {
      peakCount = entries;
      peakDay = day.date;
    }

    // Average dwell time
    if (summary.dwell && Object.keys(summary.dwell).length > 0) {
      for (const stats of Object.values(summary.dwell)) {
        if (stats.avgMinutes && stats.samples > 0) {
          totalDwellMinutes += stats.avgMinutes * stats.samples;
          dwellSamples += stats.samples;
        }
      }
    }
  }

  const avgDwell = dwellSamples > 0 ? +(totalDwellMinutes / dwellSamples).toFixed(1) : 0;

  // Exhibition dates
  const firstDay = days.length > 0 ? days[days.length - 1].date : 'N/A';
  const lastDay = days.length > 0 ? days[0].date : 'N/A';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Final Report — ${config.exhibition?.name || slug}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0d0d1a;
      color: #d4d4d4;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      padding: 3rem 2rem;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      color: #00d9ff;
      margin-bottom: 0.5rem;
      letter-spacing: -0.02em;
    }
    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #00d9ff;
      margin-top: 2rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid #1a1a2e;
      padding-bottom: 0.5rem;
    }
    .meta {
      color: #8e8e93;
      font-size: 0.95rem;
      margin-bottom: 2rem;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin: 1.5rem 0;
    }
    .stat-card {
      background: #1a1a2e;
      border: 1px solid #2a2a3e;
      border-radius: 8px;
      padding: 1.5rem;
    }
    .stat-label {
      color: #8e8e93;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #00d9ff;
    }
    .stat-unit {
      font-size: 0.9rem;
      color: #8e8e93;
      margin-left: 0.25rem;
    }
    p { margin-bottom: 1rem; color: #a8a8a8; }
    .footer {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #1a1a2e;
      color: #6e6e73;
      font-size: 0.85rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${config.exhibition?.name || slug}</h1>
    <div class="meta">
      ${config.exhibition?.venue || ''} ${config.exhibition?.city ? '— ' + config.exhibition.city : ''}<br>
      ${firstDay} a ${lastDay} · ${days.length} dias de operação
    </div>

    <h2>Síntese da Circulação</h2>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Total de Visitantes</div>
        <div class="stat-value">${totalVisitors.toLocaleString('pt-BR')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Dia de Pico</div>
        <div class="stat-value">${peakCount}</div>
        <div class="stat-unit">${peakDay || 'N/A'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Permanência Média</div>
        <div class="stat-value">${avgDwell}</div>
        <div class="stat-unit">minutos</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Dias Operacionais</div>
        <div class="stat-value">${days.length}</div>
      </div>
    </div>

    <h2>Equipamentos</h2>
    <p>
      ${config.projectors?.length || 0} projetores · 
      ${config.cameras?.length || 0} câmeras · 
      ${config.cv?.enabled !== false ? 'Computer Vision ativo' : 'CV desativado'}
    </p>

    <h2>Dados Arquivados</h2>
    <p>
      Este arquivo contém todos os registros operacionais da exposição: logs de saúde dos equipamentos, 
      dados de circulação e permanência, capturas de câmera (timelapse), outputs do sistema de visão computacional, 
      e configuração completa do sistema.
    </p>
    <p>
      Estrutura de pastas: <code>timelapse/</code>, <code>logs/</code>, <code>cv/</code>, <code>config/</code>, <code>reports/</code>
    </p>

    <div class="footer">
      AYA Studio — Exhibition Tools v2<br>
      Relatório gerado em ${new Date().toLocaleString('pt-BR')}
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`[Archiver] Final report saved: ${outputPath}`);
}

// ── Archive main function ───────────────────────────────────────────
/**
 * Archives all exhibition data to external drive.
 * @param {string} targetDrive - Drive letter (e.g., 'E')
 * @param {string} slug - Exhibition slug/folder name
 * @param {Object} config - Exhibition config
 * @param {Function} onProgress - Progress callback (step, percent, message)
 * @returns {Promise<{success: boolean, path: string, error?: string}>}
 */
async function archive(targetDrive, slug, config, onProgress) {
  const basePath = path.join(`${targetDrive}:`, slug);

  try {
    // Create base directory
    fs.mkdirSync(basePath, { recursive: true });
    onProgress({ step: 'init', percent: 0, message: 'Creating archive structure...' });

    // 1. Copy timelapse
    onProgress({ step: 'timelapse', percent: 10, message: 'Copying timelapse...' });
    const timelapseSource = path.join(__dirname, '..', 'logs', 'timelapse');
    const timelapseDest = path.join(basePath, 'timelapse');
    if (fs.existsSync(timelapseSource)) {
      copyDirRecursive(timelapseSource, timelapseDest, onProgress);
    }

    // 2. Copy health logs
    onProgress({ step: 'logs', percent: 30, message: 'Copying health logs...' });
    const logsSource = path.join(__dirname, '..', 'logs', 'health');
    const logsDest = path.join(basePath, 'logs', 'health');
    if (fs.existsSync(logsSource)) {
      copyDirRecursive(logsSource, logsDest, onProgress);
    }

    // 2b. Copy CV logs
    const cvLogsSource = path.join(__dirname, '..', 'logs', 'cv');
    const cvLogsDest = path.join(basePath, 'logs', 'cv');
    if (fs.existsSync(cvLogsSource)) {
      copyDirRecursive(cvLogsSource, cvLogsDest, onProgress);
    }

    // 3. Copy CV output data
    if (config.cv?.enabled !== false) {
      onProgress({ step: 'cv', percent: 50, message: 'Copying CV data...' });
      const cvSource = path.join(__dirname, '..', 'cv', 'python', 'output');
      const cvDest = path.join(basePath, 'cv');
      if (fs.existsSync(cvSource)) {
        copyDirRecursive(cvSource, cvDest, onProgress);
      }
    }

    // 4. Copy config
    onProgress({ step: 'config', percent: 70, message: 'Copying config...' });
    const configSource = path.join(__dirname, '..', '..', 'config', `${slug}.json`);
    const configDest = path.join(basePath, 'config');
    fs.mkdirSync(configDest, { recursive: true });
    if (fs.existsSync(configSource)) {
      fs.copyFileSync(configSource, path.join(configDest, `${slug}.json`));
    } else {
      // Try to find any matching config
      const configDir = path.join(__dirname, '..', '..', 'config');
      const configFiles = fs.readdirSync(configDir).filter(f => f.endsWith('.json'));
      if (configFiles.length > 0) {
        fs.copyFileSync(
          path.join(configDir, configFiles[0]),
          path.join(configDest, configFiles[0])
        );
      }
    }

    // 5. Generate final report
    onProgress({ step: 'report', percent: 90, message: 'Generating final report...' });
    const reportsDir = path.join(basePath, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    const reportPath = path.join(reportsDir, 'final-report.html');
    generateFinalReport(config, slug, reportPath);

    onProgress({ step: 'done', percent: 100, message: 'Archive complete!' });

    return { success: true, path: basePath };

  } catch (err) {
    console.error(`[Archiver] Archive failed: ${err.message}`);
    return { success: false, path: basePath, error: err.message };
  }
}

module.exports = {
  detectExternalDrives,
  calculateArchiveSize,
  archive,
  generateFinalReport
};
