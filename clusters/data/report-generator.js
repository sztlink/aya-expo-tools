/**
 * AYA Expo Tools — Report Generator
 *
 * Generates daily and weekly HTML reports with exhibition statistics.
 * Reports are standalone files with inline CSS (AYA dark theme).
 *
 * Usage:
 *   const reportGenerator = require('./report-generator');
 *   await reportGenerator.generateDailyReport(config);
 *   await reportGenerator.generateWeeklyReport(config);
 */

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'logs', 'reports');

// Ensure reports directory exists
function ensureReportsDir() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// ── HTML Template (AYA Dark Theme) ──────────────────────────────────
function htmlTemplate(title, content) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0d0d1a;
      color: #d4d4d4;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #00d9ff;
      margin-bottom: 0.5rem;
      letter-spacing: -0.02em;
    }
    h2 {
      font-size: 1.3rem;
      font-weight: 600;
      color: #00d9ff;
      margin-top: 2rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid #1a1a2e;
      padding-bottom: 0.5rem;
    }
    .meta {
      color: #8e8e93;
      font-size: 0.9rem;
      margin-bottom: 2rem;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin: 1rem 0;
    }
    .stat-card {
      background: #1a1a2e;
      border: 1px solid #2a2a3e;
      border-radius: 6px;
      padding: 1.25rem;
    }
    .stat-label {
      color: #8e8e93;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .stat-value {
      font-size: 1.8rem;
      font-weight: 700;
      color: #00d9ff;
    }
    .stat-unit {
      font-size: 0.85rem;
      color: #8e8e93;
      margin-left: 0.25rem;
    }
    .chart {
      background: #1a1a2e;
      border: 1px solid #2a2a3e;
      border-radius: 6px;
      padding: 1.25rem;
      margin: 1rem 0;
    }
    .bar-container {
      display: flex;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .bar-label {
      width: 80px;
      color: #8e8e93;
      font-size: 0.85rem;
      text-align: right;
      margin-right: 1rem;
    }
    .bar {
      flex: 1;
      height: 24px;
      background: linear-gradient(90deg, #00d9ff 0%, #0088cc 100%);
      border-radius: 4px;
      position: relative;
    }
    .bar-value {
      position: absolute;
      right: 8px;
      color: #0d0d1a;
      font-weight: 600;
      font-size: 0.8rem;
      line-height: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #2a2a3e;
    }
    th {
      background: #1a1a2e;
      color: #00d9ff;
      font-weight: 600;
      font-size: 0.85rem;
      text-transform: uppercase;
    }
    td { color: #a8a8a8; }
    .footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid #1a1a2e;
      color: #6e6e73;
      font-size: 0.8rem;
      text-align: center;
    }
    .status-ok { color: #4cd964; }
    .status-warn { color: #ff9500; }
    .status-error { color: #ff3b30; }
  </style>
</head>
<body>
  <div class="container">
    ${content}
    <div class="footer">
      AYA Studio — Exhibition Tools v2<br>
      Relatório gerado em ${new Date().toLocaleString('pt-BR')}
    </div>
  </div>
</body>
</html>`;
}

// ── Generate Daily Report ───────────────────────────────────────────
/**
 * Generates HTML report for yesterday's data.
 * @param {Object} config - Exhibition config
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
async function generateDailyReport(config) {
  try {
    ensureReportsDir();

    const cvLogger = require('./cv-logger');
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const summary = cvLogger.getDailySummary(yesterday);

    if (!summary) {
      console.warn(`[Report Generator] No data for ${yesterday}`);
      return { success: false, error: 'No data available' };
    }

    // Build content
    let content = `
    <h1>Relatório Diário</h1>
    <div class="meta">${config.exhibition?.name || 'Exhibition'} — ${yesterday}</div>

    <h2>Circulação</h2>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Visitantes</div>
        <div class="stat-value">${summary.counter?.entries || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pico</div>
        <div class="stat-value">${summary.peak?.count || 0}</div>
        <div class="stat-unit">${summary.peak?.time ? new Date(summary.peak.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ocupação Atual</div>
        <div class="stat-value">${summary.counter?.occupancy || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Amostras</div>
        <div class="stat-value">${summary.samples || 0}</div>
      </div>
    </div>
    `;

    // Hourly breakdown
    if (summary.hourly && Object.keys(summary.hourly).length > 0) {
      content += `
      <h2>Distribuição por Hora</h2>
      <div class="chart">`;

      const hours = Object.keys(summary.hourly).sort();
      const maxAvg = Math.max(...hours.map(h => summary.hourly[h].avgTotal || 0));

      for (const hour of hours) {
        const data = summary.hourly[hour];
        const width = maxAvg > 0 ? (data.avgTotal / maxAvg * 100) : 0;
        content += `
        <div class="bar-container">
          <div class="bar-label">${hour}:00</div>
          <div class="bar" style="width: ${width}%;">
            <div class="bar-value">${data.avgTotal.toFixed(1)}</div>
          </div>
        </div>`;
      }

      content += `</div>`;
    }

    // Zone breakdown
    if (summary.zones && Object.keys(summary.zones).length > 0) {
      content += `
      <h2>Zonas</h2>
      <table>
        <thead>
          <tr>
            <th>Zona</th>
            <th>Máximo</th>
            <th>Média</th>
            <th>Tempo Ocupada</th>
            <th>Taxa de Ocupação</th>
          </tr>
        </thead>
        <tbody>`;

      for (const [zoneId, stats] of Object.entries(summary.zones)) {
        content += `
          <tr>
            <td>${zoneId}</td>
            <td>${stats.max}</td>
            <td>${stats.avg}</td>
            <td>${stats.minutesOccupied}min</td>
            <td>${stats.occupancyRate}%</td>
          </tr>`;
      }

      content += `</tbody></table>`;
    }

    // Dwell time
    if (summary.dwell && Object.keys(summary.dwell).length > 0) {
      content += `
      <h2>Permanência Média</h2>
      <div class="stat-grid">`;

      for (const [zoneId, stats] of Object.entries(summary.dwell)) {
        if (stats.samples > 0) {
          content += `
          <div class="stat-card">
            <div class="stat-label">${zoneId}</div>
            <div class="stat-value">${stats.avgMinutes?.toFixed(1) || 0}</div>
            <div class="stat-unit">minutos</div>
          </div>`;
        }
      }

      content += `</div>`;
    }

    // Equipment status (placeholder — integrate with health cluster if available)
    content += `
    <h2>Equipamentos</h2>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Projetores</div>
        <div class="stat-value status-ok">${config.projectors?.length || 0} OK</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Câmeras</div>
        <div class="stat-value status-ok">${config.cameras?.length || 0} OK</div>
      </div>
    </div>
    `;

    const html = htmlTemplate(`Relatório Diário — ${yesterday}`, content);
    const filename = `daily-${yesterday}.html`;
    const filepath = path.join(REPORTS_DIR, filename);
    await fs.promises.writeFile(filepath, html, 'utf8');

    console.log(`[Report Generator] Daily report saved: ${filepath}`);
    return { success: true, path: filepath };

  } catch (err) {
    console.error(`[Report Generator] Daily report failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ── Generate Weekly Report ──────────────────────────────────────────
/**
 * Generates HTML report for the last 7 days.
 * @param {Object} config - Exhibition config
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
async function generateWeeklyReport(config) {
  try {
    ensureReportsDir();

    const cvLogger = require('./cv-logger');
    const days = cvLogger.listDays().slice(0, 7); // Last 7 days

    if (days.length === 0) {
      console.warn('[Report Generator] No data for weekly report');
      return { success: false, error: 'No data available' };
    }

    // Aggregate data
    let totalVisitors = 0;
    let peakDay = null;
    let peakCount = 0;
    const dailyData = [];

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

      dailyData.push({
        date: day.date,
        visitors: entries,
        peak: summary.peak?.count || 0,
        occupancyAvg: summary.counter.occupancy || 0
      });
    }

    const avgDaily = dailyData.length > 0 ? Math.round(totalVisitors / dailyData.length) : 0;

    // Build content
    const firstDay = dailyData[dailyData.length - 1]?.date || 'N/A';
    const lastDay = dailyData[0]?.date || 'N/A';

    let content = `
    <h1>Relatório Semanal</h1>
    <div class="meta">${config.exhibition?.name || 'Exhibition'} — ${firstDay} a ${lastDay}</div>

    <h2>Resumo da Semana</h2>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Total de Visitantes</div>
        <div class="stat-value">${totalVisitors}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Média Diária</div>
        <div class="stat-value">${avgDaily}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Dia de Pico</div>
        <div class="stat-value">${peakCount}</div>
        <div class="stat-unit">${peakDay || 'N/A'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Dias com Dados</div>
        <div class="stat-value">${dailyData.length}</div>
      </div>
    </div>

    <h2>Tendência Diária</h2>
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Visitantes</th>
          <th>Pico</th>
          <th>Ocupação Média</th>
        </tr>
      </thead>
      <tbody>`;

    for (const day of dailyData.reverse()) {
      content += `
        <tr>
          <td>${day.date}</td>
          <td>${day.visitors}</td>
          <td>${day.peak}</td>
          <td>${day.occupancyAvg}</td>
        </tr>`;
    }

    content += `</tbody></table>`;

    const html = htmlTemplate(`Relatório Semanal — ${firstDay} a ${lastDay}`, content);
    const filename = `weekly-${lastDay}.html`;
    const filepath = path.join(REPORTS_DIR, filename);
    await fs.promises.writeFile(filepath, html, 'utf8');

    console.log(`[Report Generator] Weekly report saved: ${filepath}`);
    return { success: true, path: filepath };

  } catch (err) {
    console.error(`[Report Generator] Weekly report failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = {
  generateDailyReport,
  generateWeeklyReport
};
