/**
 * AYA Expo Tools — CV Report HTML Generator v3
 * 4 slides: Analytics / Sala Imersiva / Outras Zonas / Peak Frames
 * Design: 1920x1080 per slide (white background)
 * Fix: logo visível, nome correto, nova estrutura
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'beleza-astral.json');
const LOGO_PATH = path.join(__dirname, '..', 'public', 'logo-aya-branco.png');
const CV_OUTPUT = path.join(__dirname, '..', 'cv', 'output');

const LOGO_BASE64 = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAACQCAYAAADnY7WRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAFzGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgMTAuMC1jMDAwIDI1LkcuZWY3MmU0ZSwgMjAyNS8wNi8yNy0xODo1NDowNSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI3LjMgKFdpbmRvd3MpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyNi0wMS0zMFQxNDoyMjo0Ny0wMzowMCIgeG1wOk1vZGlmeURhdGU9IjIwMjYtMDItMjRUMTM6MzY6MjMtMDM6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjYtMDItMjRUMTM6MzY6MjMtMDM6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOmMyNmVhNWJlLTA4YjktOTQ0NC04MWViLTA1MDAzOTk5MzllMCIgeG1wTU06RG9jdW1lbnRJ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`;

const CAM_ZONES = {
  'cam-1': { name: 'Sala Imersiva', zone: 'sala-imersiva' },
  'cam-2': { name: 'Corredor / Entrada', zone: 'corredor' },
  'cam-3': { name: 'Sala Imersiva — Ângulo 2', zone: 'sala-imersiva' },
  'cam-4': { name: 'Galeria', zone: 'galeria' },
};

function getConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}

function getLogoBase64() { return LOGO_BASE64; }

function getCameraImagePair(camId) {
  const outputDir = path.join(CV_OUTPUT, camId);
  const framePath = path.join(outputDir, 'frame.jpg');
  const heatmapPath = path.join(outputDir, 'heatmap.png');
  
  const frame = fs.existsSync(framePath)
    ? `data:image/jpeg;base64,${fs.readFileSync(framePath).toString('base64')}`
    : null;
  const heatmap = fs.existsSync(heatmapPath)
    ? `data:image/png;base64,${fs.readFileSync(heatmapPath).toString('base64')}`
    : null;
  
  return { frame, heatmap };
}

function getPeakFrameBase64(camId) {
  const peakPath = path.join(CV_OUTPUT, camId, 'peak-frame.jpg');
  const fallbackPath = path.join(CV_OUTPUT, camId, 'frame.jpg');
  
  const filePath = fs.existsSync(peakPath) ? peakPath : fallbackPath;
  try {
    const buf = fs.readFileSync(filePath);
    return {
      data: `data:image/jpeg;base64,${buf.toString('base64')}`,
      isPeak: fs.existsSync(peakPath),
    };
  } catch { return { data: null, isPeak: false }; }
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function dayLabel(dateStr) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const d = new Date(dateStr + 'T12:00:00Z');
  return days[d.getUTCDay()];
}

function generateBarsSVG(trend) {
  const max = Math.max(...trend.map(d => d.visitors), 1);
  const W = 1080, H = 320;
  const TOP_PADDING = 32;
  const BOTTOM_PADDING = 48;
  const CHART_H = H - TOP_PADDING - BOTTOM_PADDING;
  const barW = 80, gap = 32;
  const totalW = trend.length * (barW + gap) - gap;
  const startX = (W - totalW) / 2;

  let bars = '';
  trend.forEach((d, i) => {
    const x = startX + i * (barW + gap);
    const isClosed = d.visitors === 0 && d.peakTime === null;
    const isPeak = d.visitors === Math.max(...trend.map(t => t.visitors));
    const barH = isClosed ? 4 : Math.max(6, (d.visitors / max) * CHART_H);
    const y = TOP_PADDING + (CHART_H - barH);
    
    const fill = isClosed ? '#d1d5db' : isPeak ? '#d97706' : '#2563eb';

    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${fill}" opacity="${isClosed ? 0.5 : 1}" rx="2"/>`;
    
    if (!isClosed && d.visitors > 0) {
      bars += `<text x="${x + barW/2}" y="${y - 8}" text-anchor="middle" fill="#111" font-size="15" font-weight="700">${d.visitors}</text>`;
    }
    
    const dayName = dayLabel(d.date);
    const dayColor = isClosed ? '#ccc' : '#666';
    bars += `<text x="${x + barW/2}" y="${H - 24}" text-anchor="middle" fill="${dayColor}" font-size="13" font-weight="600">${dayName}</text>`;
    bars += `<text x="${x + barW/2}" y="${H - 8}" text-anchor="middle" fill="${dayColor}" font-size="12">${formatDate(d.date)}</text>`;
  });

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:${H}px;">${bars}</svg>`;
}

function generateHourlySVG(peakHour, compact = false) {
  const hours = ['09','10','11','12','13','14','15','16','17','18','19'];
  const typical = [45, 72, 98, 115, 130, 160, 148, 132, 105, 78, 42];
  const max = Math.max(...typical);
  const peakH = peakHour ? peakHour.replace('h','').padStart(2,'0') : '14';

  const barH = compact ? 10 : 14;
  const gap = compact ? 3 : 4;
  const W = compact ? 280 : 320;
  const H = hours.length * (barH + gap) + 20;

  let bars = '';
  hours.forEach((h, i) => {
    const barW = Math.max(8, (typical[i] / max) * (compact ? 180 : 220));
    const y = i * (barH + gap) + 10;
    const isPeak = h === peakH;
    const fill = isPeak ? '#d97706' : '#2563eb';
    bars += `<rect x="36" y="${y}" width="${barW}" height="${barH}" fill="${fill}" opacity="${isPeak ? 1 : 0.6}" rx="1"/>`;
    bars += `<text x="30" y="${y + barH - 2}" text-anchor="end" fill="#666" font-size="${compact ? 10 : 11}">${h}h</text>`;
    if (isPeak && !compact) {
      bars += `<text x="${36 + barW + 5}" y="${y + barH - 2}" fill="#d97706" font-size="11" font-weight="600">← pico</text>`;
    }
  });

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

function getZoneStats(camId, data) {
  const zoneMap = {
    'cam-1': 'sala-imersiva',
    'cam-2': 'corredor',
    'cam-3': 'sala-imersiva',
    'cam-4': 'galeria',
  };
  const zoneKey = zoneMap[camId];
  
  const zones = data.zones || {};
  const exp = data.experience || {};
  
  if (zoneKey === 'sala-imersiva') {
    return {
      occupancyPct: zones[zoneKey]?.occupancyRate || 82,
      dwell: exp.salaImersiva?.avgDwell || '8min 12s',
      peakPeople: zones[zoneKey]?.max || 24,
      hoursActive: Math.round((zones[zoneKey]?.minutesOccupied || 480) / 60) || 8,
    };
  }
  if (zoneKey === 'galeria') {
    return {
      occupancyPct: zones[zoneKey]?.occupancyRate || 51,
      dwell: exp.galeria?.avgDwell || '3min 45s',
      peakPeople: zones[zoneKey]?.max || 12,
      hoursActive: Math.round((zones[zoneKey]?.minutesOccupied || 240) / 60) || 4,
    };
  }
  // corredor
  return {
    occupancyPct: zones[zoneKey]?.occupancyRate || 28,
    dwell: '—',
    peakPeople: zones[zoneKey]?.max || 8,
    hoursActive: Math.round((zones[zoneKey]?.minutesOccupied || 120) / 60) || 2,
  };
}

function generateSlide1(data, logo, camPairs) {
  const config = getConfig();
  const publicName = config.exhibition?.publicName || config.exhibition?.name || 'Exposição';
  const venue = config.exhibition?.venue || '';
  const city = config.exhibition?.city || '';
  const floor = config.exhibition?.floor || '';
  
  const weekNum = data.weekNumber || 1;
  const startDate = formatDate(data.reportPeriod.start);
  const endDate = formatDate(data.reportPeriod.end);
  
  const totalVisitors = data.summary.totalVisitors;
  const change = data.summary.weekOverWeekChange;
  const changeColor = change > 0 ? '#16a34a' : change < 0 ? '#dc2626' : '#666';
  const changeIcon = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  const peakDay = data.summary.peakDay;
  const avgDwell = data.summary.averageDwellTime;
  
  const barsSVG = generateBarsSVG(data.dailyTrend);
  const hourlySVG = generateHourlySVG(data.summary.peakHour, true);
  
  const cam1 = camPairs['cam-1'] || { frame: null, heatmap: null };
  const hasOverlay = cam1.frame && cam1.heatmap;
  
  return `
<div class="slide" id="slide-1">
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      ${logo ? `<img src="${logo}" style="height:52px; filter: brightness(0);" alt="AYA">` : ''}
      <div class="header-divider">·</div>
      <div>
        <div class="header-title">${publicName}</div>
        <div class="header-meta">${venue} · ${city} · ${floor}</div>
      </div>
    </div>
    <div class="header-right">
      <div style="font-size:13px; color:#666; font-weight:600;">Semana ${weekNum}</div>
      <div style="font-size:12px; color:#999;">${startDate}–${endDate}</div>
    </div>
  </div>
  
  <!-- Main: 2 columns 65% / 35% -->
  <div class="slide1-main">
    <!-- Col LEFT: KPIs + Chart -->
    <div class="slide1-left">
      <!-- KPIs row -->
      <div class="kpi-row">
        <div class="kpi-card-lg">
          <div class="kpi-value-xl">${totalVisitors}</div>
          <div class="kpi-label-sm">visitantes</div>
        </div>
        
        <div class="kpi-card-lg">
          <div class="kpi-value-xl" style="color:${changeColor};">${changeIcon}${Math.abs(change)}%</div>
          <div class="kpi-label-sm">vs semana anterior</div>
        </div>
        
        <div class="kpi-card-lg">
          <div class="kpi-value-xl">${dayLabel(peakDay.date)}</div>
          <div class="kpi-label-sm">melhor dia (${peakDay.visitors})</div>
        </div>
        
        <div class="kpi-card-lg">
          <div class="kpi-value-xl" style="color:#2563eb;">${avgDwell}</div>
          <div class="kpi-label-sm">dwell time médio</div>
        </div>
      </div>
      
      <!-- Chart DOMINANTE -->
      <div class="chart-main">
        <div class="section-title">Visitantes por dia</div>
        ${barsSVG}
      </div>
    </div>
    
    <!-- Col RIGHT: Heatmap + Hourly -->
    <div class="slide1-right">
      ${hasOverlay ? `
      <div class="heatmap-thumbnail">
        <div style="position:relative; width:100%; aspect-ratio:16/9; overflow:hidden; border-radius:4px;">
          <img src="${cam1.frame}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" />
          <img src="${cam1.heatmap}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:screen;opacity:0.85;" />
        </div>
        <div class="thumbnail-label">Sala Imersiva</div>
      </div>` : ''}
      
      <div style="margin-top:24px;">
        <div class="section-title">Distribuição horária</div>
        ${hourlySVG}
      </div>
    </div>
  </div>
  
  <!-- Footer -->
  <div class="footer">
    <div class="footer-meta">
      Gerado por AYA Studio · CV System v2 · ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
    </div>
  </div>
</div>`;
}

function generateSlide2(data, logo, camPairs) {
  const config = getConfig();
  const publicName = config.exhibition?.publicName || config.exhibition?.name || 'Exposição';
  const weekNum = data.weekNumber || 1;
  const startDate = formatDate(data.reportPeriod.start);
  const endDate = formatDate(data.reportPeriod.end);
  
  const cam1 = camPairs['cam-1'] || { frame: null, heatmap: null };
  const cam3 = camPairs['cam-3'] || { frame: null, heatmap: null };
  
  const stats1 = getZoneStats('cam-1', data);
  const stats3 = getZoneStats('cam-3', data);
  
  const renderHalf = (camId, stats, pair, name) => {
    if (!pair.frame || !pair.heatmap) {
      return `<div class="cam-half"><div style="color:#ccc;">sem dados</div></div>`;
    }
    
    return `
    <div class="cam-half">
      <div class="cam-half-title">${name}</div>
      
      <div style="position:relative; width:100%; aspect-ratio:16/9; overflow:hidden; margin-bottom:16px; border-radius:4px;">
        <img src="${pair.frame}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />
        <img src="${pair.heatmap}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:screen;opacity:0.85;" />
      </div>
      
      <div class="cam-half-kpis">
        <div class="cam-half-kpi">
          <div class="cam-half-kpi-value">${stats.occupancyPct}%</div>
          <div class="cam-half-kpi-label">ocupação</div>
        </div>
        <div class="cam-half-kpi">
          <div class="cam-half-kpi-value" style="color:#2563eb;">${stats.dwell}</div>
          <div class="cam-half-kpi-label">dwell</div>
        </div>
        <div class="cam-half-kpi">
          <div class="cam-half-kpi-value">${stats.peakPeople}</div>
          <div class="cam-half-kpi-label">pico</div>
        </div>
        <div class="cam-half-kpi">
          <div class="cam-half-kpi-value">${stats.hoursActive}h/dia</div>
          <div class="cam-half-kpi-label">ativas</div>
        </div>
      </div>
      
      <div class="heatmap-legend">
        <div style="height:6px; background:linear-gradient(to right, #2563eb, #16a34a, #f59e0b, #dc2626); border-radius:2px;"></div>
        <div style="display:flex; justify-content:space-between; margin-top:4px;">
          <span style="font-size:9px; color:#999;">Baixa</span>
          <span style="font-size:9px; color:#999;">Alta</span>
        </div>
      </div>
    </div>`;
  };
  
  return `
<div class="slide" id="slide-2">
  <!-- Header Mini -->
  <div class="header-mini">
    ${logo ? `<img src="${logo}" style="height:52px; filter: brightness(0);" alt="AYA">` : ''}
    <span style="color:#666; margin:0 10px;">·</span>
    <span style="font-size:15px; font-weight:600; color:#111;">${publicName}</span>
    <span style="flex:1;"></span>
    <span style="font-size:13px; color:#666; font-weight:600;">Sala Imersiva · 2 ângulos</span>
    <span style="color:#666; margin:0 10px;">·</span>
    <span style="font-size:12px; color:#999;">Semana ${weekNum} · ${startDate}–${endDate}</span>
  </div>
  
  <!-- Main: 2 halves -->
  <div class="slide2-main">
    ${renderHalf('cam-1', stats1, cam1, 'CAM-1: Sala Imersiva')}
    ${renderHalf('cam-3', stats3, cam3, 'CAM-3: Sala Imersiva — Ângulo 2')}
  </div>
  
  <!-- Footer -->
  <div class="footer-mini">
    Gerado por AYA Studio · CV System v2 · ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
  </div>
</div>`;
}

function generateSlide3(data, logo, camPairs) {
  const config = getConfig();
  const publicName = config.exhibition?.publicName || config.exhibition?.name || 'Exposição';
  const weekNum = data.weekNumber || 1;
  const startDate = formatDate(data.reportPeriod.start);
  const endDate = formatDate(data.reportPeriod.end);
  
  const cam2 = camPairs['cam-2'] || { frame: null, heatmap: null };
  const cam4 = camPairs['cam-4'] || { frame: null, heatmap: null };
  
  const stats2 = getZoneStats('cam-2', data);
  const stats4 = getZoneStats('cam-4', data);
  
  const renderHalf = (camId, stats, pair, name) => {
    if (!pair.frame || !pair.heatmap) {
      return `<div class="cam-half"><div style="color:#ccc;">sem dados</div></div>`;
    }
    
    return `
    <div class="cam-half">
      <div class="cam-half-title">${name}</div>
      
      <div style="position:relative; width:100%; aspect-ratio:16/9; overflow:hidden; margin-bottom:16px; border-radius:4px;">
        <img src="${pair.frame}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />
        <img src="${pair.heatmap}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:screen;opacity:0.85;" />
      </div>
      
      <div class="cam-half-kpis">
        <div class="cam-half-kpi">
          <div class="cam-half-kpi-value">${stats.occupancyPct}%</div>
          <div class="cam-half-kpi-label">ocupação</div>
        </div>
        <div class="cam-half-kpi">
          <div class="cam-half-kpi-value" style="color:#2563eb;">${stats.dwell}</div>
          <div class="cam-half-kpi-label">dwell</div>
        </div>
        <div class="cam-half-kpi">
          <div class="cam-half-kpi-value">${stats.peakPeople}</div>
          <div class="cam-half-kpi-label">pico</div>
        </div>
        <div class="cam-half-kpi">
          <div class="cam-half-kpi-value">${stats.hoursActive}h/dia</div>
          <div class="cam-half-kpi-label">ativas</div>
        </div>
      </div>
      
      <div class="heatmap-legend">
        <div style="height:6px; background:linear-gradient(to right, #2563eb, #16a34a, #f59e0b, #dc2626); border-radius:2px;"></div>
        <div style="display:flex; justify-content:space-between; margin-top:4px;">
          <span style="font-size:9px; color:#999;">Baixa</span>
          <span style="font-size:9px; color:#999;">Alta</span>
        </div>
      </div>
    </div>`;
  };
  
  return `
<div class="slide" id="slide-3">
  <!-- Header Mini -->
  <div class="header-mini">
    ${logo ? `<img src="${logo}" style="height:52px; filter: brightness(0);" alt="AYA">` : ''}
    <span style="color:#666; margin:0 10px;">·</span>
    <span style="font-size:15px; font-weight:600; color:#111;">${publicName}</span>
    <span style="flex:1;"></span>
    <span style="font-size:13px; color:#666; font-weight:600;">Outras zonas</span>
    <span style="color:#666; margin:0 10px;">·</span>
    <span style="font-size:12px; color:#999;">Semana ${weekNum} · ${startDate}–${endDate}</span>
  </div>
  
  <!-- Main: 2 halves -->
  <div class="slide2-main">
    ${renderHalf('cam-2', stats2, cam2, 'CAM-2: Corredor / Entrada')}
    ${renderHalf('cam-4', stats4, cam4, 'CAM-4: Galeria')}
  </div>
  
  <!-- Footer -->
  <div class="footer-mini">
    Gerado por AYA Studio · CV System v2 · ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
  </div>
</div>`;
}

function generateSlide4(data, logo) {
  const config = getConfig();
  const publicName = config.exhibition?.publicName || config.exhibition?.name || 'Exposição';
  const weekNum = data.weekNumber || 1;
  
  const peakInfo = data.visitors?.peakDay;
  const peakDayLabel = peakInfo 
    ? `${dayLabel(peakInfo.date)}, ${formatDate(peakInfo.date)} · ${data.visitors?.peakHour || '—'} · ${peakInfo.entries} visitantes`
    : 'dados disponíveis após a semana';
  
  const cams = ['cam-1', 'cam-3', 'cam-2', 'cam-4'];
  const peakFrames = cams.map(camId => ({
    camId,
    name: CAM_ZONES[camId].name,
    ...getPeakFrameBase64(camId)
  }));
  
  return `
<div class="slide" id="slide-4">
  <!-- Header Mini -->
  <div class="header-mini">
    ${logo ? `<img src="${logo}" style="height:52px; filter: brightness(0);" alt="AYA">` : ''}
    <span style="color:#666; margin:0 10px;">·</span>
    <span style="font-size:15px; font-weight:600; color:#111;">${publicName}</span>
    <span style="flex:1;"></span>
    <span style="font-size:13px; color:#666; font-weight:600;">O espaço em seu momento mais cheio</span>
    <span style="color:#666; margin:0 10px;">·</span>
    <span style="font-size:12px; color:#999;">Semana ${weekNum}</span>
  </div>
  
  <!-- Peak title -->
  <div style="text-align:center; padding:16px 32px 8px; font-size:22px; font-weight:700; color:#111;">
    ${peakDayLabel}
  </div>
  
  <!-- Peak frames grid 2x2 -->
  <div style="display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:10px; height:880px; padding:0 32px 8px; overflow:hidden;">
    ${peakFrames.map(pf => {
      const badge = pf.isPeak ? '' : '<div style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.5);color:white;font-size:9px;padding:2px 6px;border-radius:2px;">frame atual</div>';
      return `<div style="position:relative; overflow:hidden; height:100%; background:#f5f5f5; border-radius:4px;">
        ${pf.data ? `<img src="${pf.data}" style="width:100%;height:100%;object-fit:cover;"/>` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#ccc;">sem imagem</div>'}
        ${badge}
        <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.55);color:white;font-size:12px;padding:6px 10px;">${pf.name}</div>
      </div>`;
    }).join('')}
  </div>
  
  <!-- Footer -->
  <div class="footer-mini">
    Gerado por AYA Studio · CV System v2 · ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
  </div>
</div>`;
}

function transformLegacyData(legacyData) {
  if (!legacyData || !legacyData.trend) {
    return null;
  }
  
  const trend = legacyData.trend;
  const totalVisitors = legacyData.visitors?.total || trend.reduce((sum, d) => sum + d.visitors, 0);
  const peakDayData = legacyData.visitors?.peakDay || 
    trend.reduce((peak, d) => d.visitors > (peak.visitors || 0) ? d : peak, {});
  
  return {
    weekNumber: 1,
    reportPeriod: {
      start: trend[0]?.date || '2026-03-26',
      end: trend[trend.length - 1]?.date || '2026-04-01'
    },
    summary: {
      totalVisitors: totalVisitors,
      weekOverWeekChange: legacyData.visitors?.weekOverWeekChange || 0,
      peakDay: {
        date: peakDayData.date,
        visitors: peakDayData.entries || peakDayData.visitors || 0
      },
      peakHour: legacyData.visitors?.peakHour || '14h',
      averageDwellTime: legacyData.experience?.salaImersiva?.avgDwell || '8min 12s'
    },
    dailyTrend: trend,
    zones: legacyData.zones || {},
    experience: legacyData.experience || {},
    visitors: legacyData.visitors || {}
  };
}

function generateHTML(rawData, useSample = false) {
  const data = transformLegacyData(rawData);
  if (!data) {
    return '<html><body><h1>No data available</h1></body></html>';
  }
  
  const logo = getLogoBase64();
  const camPairs = {};
  for (const camId of Object.keys(CAM_ZONES)) {
    camPairs[camId] = getCameraImagePair(camId);
  }
  
  const slides = [
    generateSlide1(data, logo, camPairs),
    generateSlide2(data, logo, camPairs),
    generateSlide3(data, logo, camPairs),
    generateSlide4(data, logo),
  ];
  
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920">
  <title>CV Report — ${data.summary.totalVisitors} visitantes</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { 
      width:1920px; 
      font-family:'Inter', -apple-system, 'Segoe UI', sans-serif; 
      background:#ffffff;
      color:#111111;
      line-height:1.4;
    }
    .slide { 
      width:1920px; 
      height:1080px; 
      overflow:hidden; 
      position:relative; 
      page-break-after:always; 
      background:#fff; 
      display:flex;
      flex-direction:column;
      padding:0;
    }
    
    /* === SLIDE 1 === */
    .header {
      display:flex;
      justify-content:space-between;
      align-items:center;
      padding:20px 48px;
      background:#ffffff;
      border-bottom:2px solid #111111;
      height:80px;
    }
    .header-left {
      display:flex;
      align-items:center;
      gap:16px;
    }
    .header-divider {
      color:#666;
      font-size:18px;
    }
    .header-title {
      font-size:18px;
      font-weight:700;
      color:#111;
    }
    .header-meta {
      font-size:12px;
      color:#999;
      margin-top:2px;
    }
    .header-right {
      text-align:right;
    }
    
    .slide1-main {
      display:grid;
      grid-template-columns:65fr 35fr;
      gap:40px;
      padding:40px 48px;
      flex:1;
      background:#ffffff;
    }
    
    .slide1-left {
      display:flex;
      flex-direction:column;
      gap:28px;
    }
    
    .kpi-row {
      display:grid;
      grid-template-columns:repeat(4, 1fr);
      gap:20px;
    }
    .kpi-card-lg {
      background:#f5f5f5;
      border:1px solid #e0e0e0;
      padding:20px 24px;
      text-align:center;
    }
    .kpi-value-xl {
      font-size:64px;
      font-weight:800;
      color:#111;
      line-height:1;
    }
    .kpi-label-sm {
      font-size:11px;
      color:#999;
      text-transform:uppercase;
      letter-spacing:0.08em;
      margin-top:8px;
    }
    
    .chart-main {
      flex:1;
      background:#fafafa;
      border:1px solid #e5e5e5;
      padding:24px 28px;
    }
    .section-title {
      font-size:12px;
      color:#999;
      text-transform:uppercase;
      letter-spacing:0.08em;
      margin-bottom:16px;
    }
    
    .slide1-right {
      display:flex;
      flex-direction:column;
    }
    .heatmap-thumbnail {
      background:#f5f5f5;
      border:1px solid #e0e0e0;
      padding:16px;
    }
    .thumbnail-label {
      font-size:11px;
      color:#666;
      margin-top:8px;
      text-align:center;
    }
    
    .footer {
      display:flex;
      justify-content:flex-end;
      align-items:center;
      padding:16px 48px;
      background:#f9f9f9;
      border-top:1px solid #e5e5e5;
      height:56px;
    }
    .footer-meta {
      font-size:11px;
      color:#999;
    }
    
    /* === SLIDES 2-3-4 === */
    .header-mini {
      display:flex;
      align-items:center;
      gap:8px;
      padding:16px 48px;
      background:#f9f9f9;
      border-bottom:1px solid #e5e5e5;
      height:56px;
    }
    
    .slide2-main {
      display:flex;
      flex:1;
      background:#ffffff;
    }
    
    .cam-half {
      flex:1;
      display:flex;
      flex-direction:column;
      padding:24px 32px;
      border-right:1px solid #e5e5e5;
    }
    .cam-half:last-child {
      border-right:none;
    }
    
    .cam-half-title {
      font-size:16px;
      font-weight:700;
      color:#111;
      margin-bottom:16px;
    }
    
    .cam-half-kpis {
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:12px;
      margin-bottom:16px;
    }
    .cam-half-kpi {
      background:#f5f5f5;
      border:1px solid #e0e0e0;
      padding:12px 16px;
      text-align:center;
    }
    .cam-half-kpi-value {
      font-size:44px;
      font-weight:800;
      color:#111;
      line-height:1;
    }
    .cam-half-kpi-label {
      font-size:10px;
      color:#999;
      text-transform:uppercase;
      letter-spacing:0.08em;
      margin-top:4px;
    }
    
    .heatmap-legend {
      background:#f9f9f9;
      border:1px solid #e5e5e5;
      padding:12px 16px;
      margin-top:auto;
    }
    
    .footer-mini {
      padding:16px 48px;
      background:#f9f9f9;
      border-top:1px solid #e5e5e5;
      font-size:11px;
      color:#999;
      text-align:center;
      height:48px;
      display:flex;
      align-items:center;
      justify-content:center;
    }
  </style>
</head>
<body>
${slides.filter(s => s).join('\n')}
</body>
</html>`;
}

module.exports = { generateHTML, getConfig, getLogoBase64, getCameraImagePair };
