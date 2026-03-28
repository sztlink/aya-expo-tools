/**
 * AYA Expo Tools — CV Notify
 * 
 * Sends daily and weekly visitor reports via Telegram.
 * 
 * Schedule:
 *   - Daily: 20:30 local time (end of expo day)
 *   - Weekly: Monday 09:00 local time
 */

const https = require('https');
const path = require('path');
const fs = require('fs');

// Load from config or env
function getNotifyConfig() {
  try {
    const configPath = path.join(__dirname, '..', 'config', 'beleza-astral.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.notify || null;
  } catch { return null; }
}

function sendTelegram(token, chatId, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ ok: false, error: 'Invalid JSON response' });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function formatDailyReport(report, expoName) {
  if (!report || report.status === 'no_data') {
    return `📊 <b>${expoName}</b>\nNenhum visitante registrado hoje.`;
  }

  const today = report.trend?.slice(-1)[0];
  const visitors = today?.visitors || 0;
  const peak = today?.peak || 0;
  const peakTime = today?.peakTime || '--';

  const salaImersiva = report.experience?.salaImersiva;
  const dwellStr = salaImersiva ? `⏱ Dwell Sala Imersiva: <b>${salaImersiva.avgDwell}</b>` : '';

  const peakHour = report.visitors?.peakHour || '--';

  return [
    `🎨 <b>${expoName} — Relatório do Dia</b>`,
    ``,
    `👥 Visitantes hoje: <b>${visitors}</b>`,
    `📈 Pico simultâneo: <b>${peak}</b> pessoas (${peakTime})`,
    `🕐 Horário mais movimentado: ${peakHour}`,
    dwellStr,
    ``,
    `📅 Total desde abertura: <b>${report.visitors?.total || 0}</b>`,
    `📊 Média/dia: <b>${report.visitors?.avgPerDay || 0}</b>`,
  ].filter(Boolean).join('\n');
}

function formatWeeklyReport(report, expoName) {
  if (!report || report.daysOpen === 0) {
    return `📊 <b>${expoName} — Resumo Semanal</b>\nNenhum dado disponível.`;
  }

  const trend = (report.trend || []).slice(-7).map(d =>
    `  ${d.date.slice(5)}: ${d.visitors} visitantes`
  ).join('\n');

  return [
    `🎨 <b>${expoName} — Resumo Semanal</b>`,
    ``,
    `👥 Total: <b>${report.visitors?.total || 0}</b> visitantes`,
    `📊 Média/dia: <b>${report.visitors?.avgPerDay || 0}</b>`,
    `🏆 Melhor dia: ${report.visitors?.peakDay?.date} (${report.visitors?.peakDay?.entries} visitantes)`,
    ``,
    `📅 Últimos 7 dias:`,
    trend,
  ].filter(Boolean).join('\n');
}

let _cvReport = null;
let _config = null;
let _dailyTimer = null;
let _weeklyTimer = null;

function msUntil(hour, minute, tz = 'America/Sao_Paulo') {
  const now = new Date();
  const nowLocal = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const target = new Date(nowLocal);
  target.setHours(hour, minute, 0, 0);
  if (target <= nowLocal) target.setDate(target.getDate() + 1);
  return target - nowLocal;
}

function msUntilNextMonday(hour, minute, tz = 'America/Sao_Paulo') {
  const now = new Date();
  const nowLocal = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const daysUntilMonday = (8 - nowLocal.getDay()) % 7 || 7;
  const target = new Date(nowLocal);
  target.setDate(target.getDate() + daysUntilMonday);
  target.setHours(hour, minute, 0, 0);
  return target - nowLocal;
}

async function sendDailyReport() {
  try {
    const notify = getNotifyConfig();
    if (!notify?.telegram?.token) {
      console.log('[CV Notify] No telegram config, skipping');
      return;
    }
    const report = _cvReport?.publicReport?.() || null;
    const expoName = _config?.exhibition?.name || 'Expo';
    const msg = formatDailyReport(report, expoName);
    await sendTelegram(notify.telegram.token, notify.telegram.chatId, msg);
    console.log('[CV Notify] Daily report sent');
  } catch (e) {
    console.error('[CV Notify] Error sending daily report:', e.message);
  }
}

async function sendWeeklyReport() {
  try {
    const notify = getNotifyConfig();
    if (!notify?.telegram?.token) return;
    const report = _cvReport?.publicReport?.() || null;
    const expoName = _config?.exhibition?.name || 'Expo';
    const msg = formatWeeklyReport(report, expoName);
    await sendTelegram(notify.telegram.token, notify.telegram.chatId, msg);
    console.log('[CV Notify] Weekly report sent');
  } catch (e) {
    console.error('[CV Notify] Error sending weekly report:', e.message);
  }
}

function scheduleDaily() {
  const ms = msUntil(20, 30);
  console.log(`[CV Notify] Daily report scheduled in ${Math.round(ms / 60000)}min (20:30)`);
  _dailyTimer = setTimeout(async () => {
    await sendDailyReport();
    scheduleDaily(); // reschedule for next day
  }, ms);
}

function scheduleWeekly() {
  const ms = msUntilNextMonday(9, 0);
  console.log(`[CV Notify] Weekly report scheduled in ${Math.round(ms / 3600000)}h (Monday 09:00)`);
  _weeklyTimer = setTimeout(async () => {
    await sendWeeklyReport();
    scheduleWeekly(); // reschedule
  }, ms);
}

function start(cvReportModule, config) {
  _cvReport = cvReportModule;
  _config = config;
  
  const notify = getNotifyConfig();
  if (!notify?.telegram?.token) {
    console.log('[CV Notify] Telegram not configured - reports disabled');
    return;
  }
  
  scheduleDaily();
  scheduleWeekly();
  console.log('[CV Notify] Started — reports at 20:30 daily + Monday 09:00 weekly');
}

function stop() {
  if (_dailyTimer) clearTimeout(_dailyTimer);
  if (_weeklyTimer) clearTimeout(_weeklyTimer);
  console.log('[CV Notify] Stopped');
}

module.exports = { start, stop, sendDailyReport, sendWeeklyReport };
