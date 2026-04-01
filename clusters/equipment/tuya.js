/**
 * AYA Expo Tools — Tuya Cloud Smart Plug Control
 *
 * Controls smart plugs via Tuya Cloud API (v1.0).
 * Uses Cloud API (not local protocol) because Tuya 3.4 requires localKey
 * and local control is unreliable on expo networks.
 *
 * Credentials stored in config/tuya-cloud.json (gitignored).
 */

const crypto = require('crypto')
const https = require('https')
const fs = require('fs')
const path = require('path')

const CREDS_PATH = path.join(__dirname, '..', 'config', 'tuya-cloud.json')
const BASE_HOST = 'openapi.tuyaus.com' // Western America Data Center

let _token = null
let _tokenExpires = 0
let _tokenPromise = null  // mutex: evita race condition em chamadas simultâneas

// ─── Load credentials ─────────────────────────────────────────

function loadCreds() {
  if (!fs.existsSync(CREDS_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'))
  } catch { return null }
}

// ─── Signing ──────────────────────────────────────────────────

function calcSign(clientId, secret, t, token, method, path, body) {
  const contentHash = crypto.createHash('sha256').update(body || '').digest('hex')
  const stringToSign = method.toUpperCase() + '\n' + contentHash + '\n' + '' + '\n' + path
  const signStr = clientId + (token || '') + t + stringToSign
  return crypto.createHmac('sha256', secret).update(signStr).digest('hex').toUpperCase()
}

function apiRequest(method, apiPath, body, token) {
  const creds = loadCreds()
  if (!creds) return Promise.reject(new Error('Tuya credentials not configured'))

  return new Promise((resolve, reject) => {
    const t = Date.now().toString()
    const sig = calcSign(creds.clientId, creds.clientSecret, t, token, method, apiPath, body)
    const opts = {
      hostname: BASE_HOST, port: 443, path: apiPath, method,
      headers: {
        'client_id': creds.clientId,
        'sign': sig,
        'sign_method': 'HMAC-SHA256',
        't': t,
      }
    }
    if (token) opts.headers['access_token'] = token
    if (body) opts.headers['Content-Type'] = 'application/json'
    const req = https.request(opts, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try { resolve(JSON.parse(d)) } catch { resolve(d) }
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')) })
    if (body) req.write(body)
    req.end()
  })
}

// ─── Token management ─────────────────────────────────────────

async function getToken() {
  if (_token && Date.now() < _tokenExpires) return _token
  // Mutex: se já existe uma requisição de token em andamento, aguarda ela
  if (_tokenPromise) return _tokenPromise
  _tokenPromise = apiRequest('GET', '/v1.0/token?grant_type=1')
    .then(res => {
      if (!res.success) throw new Error('Tuya token error: ' + (res.msg || JSON.stringify(res)))
      _token = res.result.access_token
      _tokenExpires = Date.now() + (res.result.expire_time * 1000) - 60000
      return _token
    })
    .finally(() => { _tokenPromise = null })
  return _tokenPromise
}

// ─── Device control ───────────────────────────────────────────

async function getStatus(deviceId) {
  const token = await getToken()
  const res = await apiRequest('GET', '/v1.0/devices/' + deviceId + '/status', null, token)
  if (!res.success) throw new Error('Status error: ' + (res.msg || JSON.stringify(res)))
  const sw = res.result.find(s => s.code === 'switch_1')
  return {
    on: sw ? sw.value : null,
    raw: res.result,
  }
}

async function turnOn(deviceId) {
  const token = await getToken()
  const body = JSON.stringify({ commands: [{ code: 'switch_1', value: true }] })
  const res = await apiRequest('POST', '/v1.0/devices/' + deviceId + '/commands', body, token)
  if (!res.success) throw new Error('Turn on error: ' + (res.msg || JSON.stringify(res)))
  return { ok: true }
}

async function turnOff(deviceId) {
  const token = await getToken()
  const body = JSON.stringify({ commands: [{ code: 'switch_1', value: false }] })
  const res = await apiRequest('POST', '/v1.0/devices/' + deviceId + '/commands', body, token)
  if (!res.success) throw new Error('Turn off error: ' + (res.msg || JSON.stringify(res)))
  return { ok: true }
}

// ─── Bulk operations ──────────────────────────────────────────

async function allOn(plugs) {
  const results = await Promise.allSettled(plugs.map(p => turnOn(p.deviceId)))
  return plugs.map((p, i) => ({
    id: p.id,
    ok: results[i].status === 'fulfilled',
    error: results[i].status === 'rejected' ? results[i].reason.message : null,
  }))
}

async function allOff(plugs) {
  const results = await Promise.allSettled(plugs.map(p => turnOff(p.deviceId)))
  return plugs.map((p, i) => ({
    id: p.id,
    ok: results[i].status === 'fulfilled',
    error: results[i].status === 'rejected' ? results[i].reason.message : null,
  }))
}

async function allStatus(plugs) {
  const results = await Promise.allSettled(plugs.map(p => getStatus(p.deviceId)))
  return plugs.map((p, i) => ({
    id: p.id,
    controls: p.controls,
    on: results[i].status === 'fulfilled' ? results[i].value.on : null,
    error: results[i].status === 'rejected' ? results[i].reason.message : null,
  }))
}

function isConfigured() {
  return fs.existsSync(CREDS_PATH)
}

module.exports = { getStatus, turnOn, turnOff, allOn, allOff, allStatus, isConfigured }
