#!/usr/bin/env node
/**
 * daily-report.js — Relatório diário da exposição Beleza Astral
 * 
 * Puxa dados das APIs do aya-expo-tools, gera gráfico SVG de ocupação
 * por hora, busca frames das câmeras no momento de pico, e envia
 * email HTML via aya-gmail.
 * 
 * Uso:
 *   node scripts/daily-report.js                    # envia pra felipe@aya.cx
 *   node scripts/daily-report.js --to outro@email   # outro destinatário
 *   node scripts/daily-report.js --dry-run           # só mostra, não envia
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- Config ---
const MEDIASERVER = process.env.MEDIASERVER_URL || 'http://10.253.0.11:3000';
const GMAIL_SCRIPT = path.join(process.env.HOME || process.env.USERPROFILE, '.pi/agent/skills/aya/aya-gmail/scripts/send.js');
const TMP_DIR = path.join(process.env.HOME || process.env.USERPROFILE, 'Documents/aya-workspace/tmp');
const DEFAULT_TO = 'felipe@aya.cx';
const CAMERAS = ['cam-1', 'cam-2', 'cam-3', 'cam-4'];
const CAMERA_NAMES = { 'cam-1': 'Sala Imersiva A', 'cam-2': 'Galeria Principal', 'cam-3': 'Sala Imersiva B', 'cam-4': 'Galeria' };
const ZONE_NAMES = { 'sala-imersiva': 'Sala Imersiva', 'galeria': 'Galeria', 'corredor': 'Corredor', 'galeria-principal': 'Galeria Principal' };

// Colors for zones in chart
const ZONE_COLORS = {
  'sala-imersiva': '#2563eb',
  'galeria': '#7c3aed', 
  'corredor': '#64748b',
  'galeria-principal': '#0891b2',
};

// --- Args ---
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const toIdx = args.indexOf('--to');
const to = toIdx >= 0 ? args[toIdx + 1] : DEFAULT_TO;

// --- Helpers ---
async function fetchJSON(endpoint) {
  try {
    const res = await fetch(`${MEDIASERVER}${endpoint}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(`⚠ Fetch failed: ${endpoint} — ${e.message}`);
    return null;
  }
}

async function fetchImage(endpoint, filepath) {
  try {
    const res = await fetch(`${MEDIASERVER}${endpoint}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filepath, buf);
    return true;
  } catch (e) {
    console.error(`⚠ Image fetch failed: ${endpoint} — ${e.message}`);
    return false;
  }
}

/**
 * Fetch timelapse frame closest to a timestamp from the mediaserver via SSH.
 * Frames are named HHMMSS.jpg in D:\aya-expo-data\timelapse\{date}\{cam}\
 */
function fetchTimelapseFrame(date, camId, targetHHMMSS, outPath) {
  const SSH = `ssh -i ${path.join(process.env.HOME || process.env.USERPROFILE, '.ssh/id_ed25519_mediaserver')} -o ConnectTimeout=10 -o StrictHostKeyChecking=no aya@10.253.0.11`;
  const baseDir = `D:\\aya-expo-data\\timelapse\\${date}\\${camId}`;
  
  try {
    // List files near target time, find closest
    const prefix = targetHHMMSS.slice(0, 4); // HHMM
    const listCmd = `${SSH} "dir ${baseDir}\\${prefix}*.jpg /b /on 2>nul"`;
    const files = execSync(listCmd, { encoding: 'utf8', timeout: 10000 }).trim().split(/\r?\n/).filter(f => f.endsWith('.jpg'));
    
    if (files.length === 0) {
      // Try broader prefix (just HH)
      const prefix2 = targetHHMMSS.slice(0, 2);
      const listCmd2 = `${SSH} "dir ${baseDir}\\${prefix2}3*.jpg /b /on 2>nul"`;
      const files2 = execSync(listCmd2, { encoding: 'utf8', timeout: 10000 }).trim().split(/\r?\n/).filter(f => f.endsWith('.jpg'));
      if (files2.length === 0) return false;
      files.push(...files2);
    }
    
    // Find closest to target
    const target = parseInt(targetHHMMSS);
    let closest = files[0];
    let minDiff = Infinity;
    for (const f of files) {
      const ts = parseInt(f.replace('.jpg', ''));
      const diff = Math.abs(ts - target);
      if (diff < minDiff) { minDiff = diff; closest = f; }
    }
    
    // Fetch via SSH binary cat
    const catCmd = `${SSH} "type ${baseDir}\\${closest}"`;
    const buf = execSync(catCmd, { timeout: 15000, maxBuffer: 5 * 1024 * 1024 });
    fs.writeFileSync(outPath, buf);
    return closest.replace('.jpg', '');
  } catch (e) {
    console.error(`  ⚠ Timelapse frame failed: ${camId} — ${e.message.split('\n')[0]}`);
    return false;
  }
}

function fmt(n) { return n == null ? '—' : typeof n === 'number' ? n.toLocaleString('pt-BR') : String(n); }
function fmtTemp(c) { return c != null ? `${c}°C` : '—'; }
function fmtDwell(s) { if (!s) return '—'; return s < 60 ? `${Math.round(s)}s` : `${Math.floor(s/60)}m${Math.round(s%60)}s`; }
function dot(ok) { return ok ? '🟢' : '🔴'; }

// --- HTML Chart: Gmail-safe paired bars per hour (bgcolor + height on td) ---
function buildHourlyChart(hourlyData, counterHourly) {
  // Use counter hourly (entries/exits) like portal does
  const hours = [];
  for (let h = 8; h <= 21; h++) hours.push(h);
  
  const BAR_H = 80; // max bar height px
  
  // Find max value across all hours
  let maxVal = 1;
  for (const h of hours) {
    const key = String(h);
    const d = counterHourly?.[key];
    if (d) {
      const v = Math.max(d.entries || 0, d.exits || 0);
      if (v > maxVal) maxVal = v;
    }
  }

  // Build one column per hour: spacer + entry bar + exit bar side by side + label
  const cols = hours.map(h => {
    const key = String(h);
    const d = counterHourly?.[key];
    const ent = d?.entries || 0;
    const ext = d?.exits || 0;
    
    const entH = maxVal > 0 ? Math.round((ent / maxVal) * BAR_H) : 0;
    const extH = maxVal > 0 ? Math.round((ext / maxVal) * BAR_H) : 0;
    const entSpacer = BAR_H - entH;
    const extSpacer = BAR_H - extH;
    
    // Each bar = a 2-row table (spacer on top, colored bar on bottom)
    const entBar = ent > 0
      ? `<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td height="${entSpacer}" style="font-size:1px;line-height:1px;">&nbsp;</td></tr><tr><td height="${entH}" bgcolor="#10b981" style="font-size:1px;line-height:1px;">&nbsp;</td></tr></table>`
      : `<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td height="${BAR_H}" style="font-size:1px;line-height:1px;">&nbsp;</td></tr></table>`;
    const extBar = ext > 0
      ? `<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td height="${extSpacer}" style="font-size:1px;line-height:1px;">&nbsp;</td></tr><tr><td height="${extH}" bgcolor="#3b82f6" style="font-size:1px;line-height:1px;">&nbsp;</td></tr></table>`
      : `<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td height="${BAR_H}" style="font-size:1px;line-height:1px;">&nbsp;</td></tr></table>`;
    
    // Count label on top
    const countLabel = (ent > 0 || ext > 0) ? `${ent}` : '';
    
    return `<td valign="bottom" align="center" style="padding:0 1px;">
      <table cellpadding="0" cellspacing="0" border="0" align="center">
        ${countLabel ? `<tr><td colspan="2" align="center" style="font-size:9px;color:#999;font-family:Arial,sans-serif;padding-bottom:2px;">${countLabel}</td></tr>` : ''}
        <tr>
          <td valign="bottom" width="8">${entBar}</td>
          <td width="2" style="font-size:1px;">&nbsp;</td>
          <td valign="bottom" width="8">${extBar}</td>
        </tr>
        <tr><td colspan="3" align="center" style="font-size:10px;color:#888;font-family:Arial,sans-serif;padding-top:4px;border-top:1px solid #e5e5e5;">${h}</td></tr>
      </table>
    </td>`;
  }).join('');

  // Legend
  const legend = `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tr>
    <td width="10" height="10" bgcolor="#10b981" style="font-size:1px;">&nbsp;</td>
    <td style="font-size:11px;color:#555;font-family:Arial,sans-serif;padding:0 16px 0 5px;">entradas</td>
    <td width="10" height="10" bgcolor="#3b82f6" style="font-size:1px;">&nbsp;</td>
    <td style="font-size:11px;color:#555;font-family:Arial,sans-serif;padding-left:5px;">saídas</td>
  </tr></table>`;

  return `<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${cols}</tr></table>${legend}`;
}

// --- Main ---
async function main() {
  const now = new Date();
  const reportDate = now.toISOString().split('T')[0];
  console.log(`📊 Gerando relatório Beleza Astral — ${reportDate}`);

  fs.mkdirSync(TMP_DIR, { recursive: true });

  // Fetch all APIs in parallel
  const [health, cv, dailySummary, timelapse, schedule, counterHistory] = await Promise.all([
    fetchJSON('/api/health'),
    fetchJSON('/api/cv/status'),
    fetchJSON('/api/cv/daily/today/summary'),
    fetchJSON('/api/timelapse/stats'),
    fetchJSON('/api/schedule'),
    fetchJSON('/api/cv/counter/history'),
  ]);

  if (!health) {
    console.error('❌ Mediaserver inacessível. Abortando.');
    process.exit(1);
  }

  // --- Peak frames ---
  const peakTime = dailySummary?.peak?.time || cv?.peak?.timestamp;
  let peakTimeLabel = '—';
  const peakFramePaths = [];
  const peakCids = [];

  if (peakTime) {
    const pt = new Date(peakTime);
    peakTimeLabel = pt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    
    // Convert peak time to local HHMMSS for timelapse lookup
    const peakLocal = pt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo', hour12: false });
    const peakHHMMSS = peakLocal.replace(/:/g, '');
    
    console.log(`📸 Buscando frames do timelapse no pico (${peakTimeLabel} → ${peakHHMMSS})...`);
    
    for (const camId of CAMERAS) {
      const framePath = path.join(TMP_DIR, `peak-${camId}.jpg`);
      const result = fetchTimelapseFrame(reportDate, camId, peakHHMMSS, framePath);
      if (result) {
        peakFramePaths.push({ camId, path: framePath, cid: `peak-${camId}` });
        peakCids.push({ camId, cid: `peak-${camId}` });
        console.log(`  ✅ ${camId} → ${result}`);
      } else {
        console.log(`  ⚠ ${camId} sem frame`);
      }
    }
  }

  // --- Data extraction ---
  const exhibition = health.exhibition || 'Beleza Astral';
  const uptime = health.uptime ? `${Math.floor(health.uptime / 3600)}h${Math.floor((health.uptime % 3600) / 60)}m` : '—';
  
  // Use daily summary (more complete, persisted across restarts)
  const ds = dailySummary || {};
  const totalVisitors = ds.reid?.uniqueVisitors ?? '—';
  const peakCount = ds.peak?.count ?? cv?.peak?.count ?? '—';
  const entries = ds.counter?.entries ?? cv?.counter?.entries ?? '—';
  const exits = ds.counter?.exits ?? cv?.counter?.exits ?? '—';
  
  // Zones dwell
  const dwell = ds.dwell || cv?.dwell || {};
  
  // Hourly data for chart — use counterHourly (entries/exits per hour) like portal
  const counterHourly = ds.counterHourly || cv?.counter?.hourly || {};
  const chartHtml = buildHourlyChart(ds.hourly || {}, counterHourly);

  // Schedule
  const todaySchedule = schedule?.today || {};
  const openTime = todaySchedule.open || schedule?.powerOn || '—';
  const closeTime = todaySchedule.close || schedule?.powerOff || '—';
  const dayLabel = todaySchedule.label || todaySchedule.day || '—';

  // History (last 7 days for context)
  const history = (counterHistory || []).slice(0, 7);

  // GPUs
  const gpus = health.server?.gpus || [];

  // Timelapse
  const tlCaptures = timelapse?.captures ?? '—';
  const tlDates = timelapse?.storage?.dates ?? '—';

  // Zone occupancy rates
  const zoneOcc = ds.zones || {};

  // --- Build HTML (light theme) ---
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;color:#1a1a1a;font-family:'Helvetica Neue',Arial,sans-serif;line-height:1.5;">

<!-- Header -->
<div style="background:#f8f8f8;padding:28px 32px;border-bottom:2px solid #e5e5e5;">
  <div style="font-size:11px;text-transform:uppercase;letter-spacing:2.5px;color:#999;margin-bottom:6px;">Relatório Diário</div>
  <div style="font-size:26px;font-weight:600;color:#111;">${exhibition}</div>
  <div style="font-size:14px;color:#666;margin-top:4px;">${dayLabel} · ${reportDate} · ${openTime}–${closeTime}</div>
</div>

<!-- Público — números grandes -->
<div style="padding:28px 32px 20px;">
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="padding:0 0 20px;vertical-align:top;">
        <div style="font-size:48px;font-weight:300;color:#111;">${fmt(totalVisitors)}</div>
        <div style="font-size:12px;color:#888;margin-top:2px;">visitantes únicos</div>
      </td>
      <td style="padding:0 0 20px;text-align:center;vertical-align:top;">
        <div style="font-size:48px;font-weight:300;color:#111;">${fmt(peakCount)}</div>
        <div style="font-size:12px;color:#888;margin-top:2px;">pico simultâneo · ${peakTimeLabel}</div>
      </td>
      <td style="padding:0 0 20px;text-align:right;vertical-align:top;">
        <div style="font-size:48px;font-weight:300;color:#111;">${fmt(entries)}</div>
        <div style="font-size:12px;color:#888;margin-top:2px;">entradas · ${fmt(exits)} saídas</div>
      </td>
    </tr>
  </table>
</div>

<!-- Gráfico de ocupação por hora -->
<div style="padding:0 32px 28px;">
  <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#999;margin-bottom:14px;">Fluxo por Hora</div>
  ${chartHtml}
</div>

<!-- Zonas -->
<div style="padding:0 32px 24px;">
  <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#999;margin-bottom:12px;">Permanência por Zona</div>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr style="color:#999;font-size:10px;text-transform:uppercase;letter-spacing:1px;">
      <td style="padding:8px 0;border-bottom:2px solid #eee;">Zona</td>
      <td style="padding:8px 0;border-bottom:2px solid #eee;text-align:center;">Dwell Médio</td>
      <td style="padding:8px 0;border-bottom:2px solid #eee;text-align:center;">Dwell Máx</td>
      <td style="padding:8px 0;border-bottom:2px solid #eee;text-align:center;">Taxa Ocupação</td>
      <td style="padding:8px 0;border-bottom:2px solid #eee;text-align:right;">Amostras</td>
    </tr>
    ${Object.entries(dwell).map(([id, z]) => {
      const occ = zoneOcc[id];
      const occRate = occ?.occupancyRate != null ? `${occ.occupancyRate.toFixed(0)}%` : '—';
      const color = ZONE_COLORS[id] || '#666';
      return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;"><span style="display:inline-block;width:8px;height:8px;background:${color};border-radius:2px;margin-right:8px;vertical-align:middle;"></span>${ZONE_NAMES[id] || id}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:500;">${fmtDwell(z.avgSeconds)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:center;color:#888;">${fmtDwell(z.maxSeconds)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:center;color:#888;">${occRate}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#888;">${fmt(z.samples)}</td>
    </tr>`;
    }).join('')}
  </table>
</div>

${peakCids.length > 0 ? `
<!-- Frames do pico -->
<div style="padding:0 32px 28px;">
  <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#999;margin-bottom:14px;">Momento de Pico · ${peakTimeLabel} · ${fmt(peakCount)} pessoas</div>
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      ${peakCids.slice(0, 2).map(f => `
      <td style="padding:0 ${f === peakCids[0] ? '6px 0 0' : '0 0 6px'};width:50%;vertical-align:top;">
        <img src="cid:${f.cid}" style="width:100%;height:auto;border-radius:0;display:block;" />
        <div style="font-size:10px;color:#999;margin-top:4px;">${CAMERA_NAMES[f.camId] || f.camId}</div>
      </td>`).join('')}
    </tr>
    ${peakCids.length > 2 ? `<tr>
      ${peakCids.slice(2, 4).map(f => `
      <td style="padding:8px ${f === peakCids[2] ? '6px 0 0' : '0 0 6px'};width:50%;vertical-align:top;">
        <img src="cid:${f.cid}" style="width:100%;height:auto;border-radius:0;display:block;" />
        <div style="font-size:10px;color:#999;margin-top:4px;">${CAMERA_NAMES[f.camId] || f.camId}</div>
      </td>`).join('')}
    </tr>` : ''}
  </table>
</div>
` : ''}

<!-- Histórico 7 dias -->
${history.length > 0 ? `
<div style="padding:0 32px 24px;">
  <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#999;margin-bottom:12px;">Últimos 7 Dias</div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <tr style="color:#999;font-size:10px;text-transform:uppercase;letter-spacing:1px;">
      <td style="padding:6px 0;border-bottom:2px solid #eee;">Data</td>
      <td style="padding:6px 0;border-bottom:2px solid #eee;text-align:center;">Entradas</td>
      <td style="padding:6px 0;border-bottom:2px solid #eee;text-align:center;">Saídas</td>
      <td style="padding:6px 0;border-bottom:2px solid #eee;text-align:right;">Dwell Médio</td>
    </tr>
    ${history.map(d => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">${d.date}</td>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:500;">${fmt(d.entries)}</td>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:center;color:#888;">${fmt(d.exits)}</td>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#888;">${d.dwellTime?.avgFormatted || '—'}</td>
    </tr>`).join('')}
  </table>
</div>` : ''}

<!-- Infraestrutura (compacto) -->
<div style="padding:0 32px 24px;">
  <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#999;margin-bottom:12px;">Infraestrutura</div>
  <div style="font-size:12px;color:#666;line-height:2;">
    ${dot(health.status === 'ok')} Sistema OK
    · ${dot(health.projectors > 0)} ${health.projectors} projetores
    · ${dot(health.cameras > 0)} ${health.cameras} câmeras
    · ${dot(health.tvs > 0)} ${health.tvs} TVs
    · ${dot(health.server?.resolume)} Resolume
    · ${dot(cv?.running)} CV ${cv?.model || ''}
    <br/>
    ${gpus.map((g, i) => `GPU${i}: ${fmtTemp(g.temp)} ${g.utilization}% ${g.fan}%fan`).join(' · ')}
    · RAM ${health.server?.ram?.pct}%
    · C: ${health.server?.disk?.drives?.C?.free}GB livres
    · D: ${health.server?.disk?.drives?.D?.free}GB livres
    · Uptime ${uptime}
    <br/>
    Timelapse: ${fmt(tlCaptures)} capturas · ${tlDates} dias no arquivo
  </div>
</div>

<!-- Footer -->
<div style="padding:16px 32px;border-top:1px solid #e5e5e5;">
  <div style="font-size:10px;color:#bbb;">
    ▲ szt.link · aya-expo-tools · gerado ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
  </div>
</div>

</body>
</html>`;

  // --- Write HTML ---
  const htmlPath = path.join(TMP_DIR, `report-${reportDate}.html`);
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`📄 HTML: ${htmlPath}`);

  if (dryRun) {
    console.log('\n🔍 Dry run — email não enviado.');
    console.log(`📊 Resumo: ${totalVisitors} visitantes, pico ${peakCount} às ${peakTimeLabel}, ${entries} entradas`);
    return;
  }

  // --- Send email ---
  const subject = `${exhibition} · ${reportDate} · ${totalVisitors} visitantes · pico ${peakCount}`;
  
  let inlineArgs = '';
  for (const f of peakFramePaths) {
    inlineArgs += ` --inline-image "${f.path.replace(/\\/g, '/')}:${f.cid}"`;
  }

  const cmd = `node "${GMAIL_SCRIPT}" --to "${to}" --subject "${subject}" --body-file "${htmlPath.replace(/\\/g, '/')}" --html${inlineArgs}`;
  
  console.log(`📧 Enviando para ${to} (${peakFramePaths.length} imagens inline)...`);
  try {
    const out = execSync(cmd, { encoding: 'utf8', timeout: 60000 });
    console.log(`✅ Enviado!`, out.trim());
  } catch (e) {
    console.error(`❌ Falha ao enviar:`, e.message);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
