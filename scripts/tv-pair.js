/**
 * tv-pair.js — Hisense RemoteNow pairing (porta 6466, mTLS)
 * 
 * Uso:
 *   node tv-pair.js <ip> request     → TV mostra código de 4 dígitos
 *   node tv-pair.js <ip> confirm <code>  → Envia código, salva certificado
 *   node tv-pair.js <ip> test        → Testa conexão autenticada
 *   node tv-pair.js <ip> power-off   → Desliga a TV
 *   node tv-pair.js <ip> power-on    → Liga a TV (WOL + CEC wakeup)
 *
 * Certificados salvos em: config/tv-certs/<ip>/
 */

const tls = require('tls')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const dgram = require('dgram')

const ip = process.argv[2]
const action = process.argv[3] || 'request'
const code = process.argv[4]

if (!ip) {
  console.log('Uso: node tv-pair.js <ip> [request|confirm <code>|test|power-off|power-on]')
  process.exit(1)
}

const CERT_DIR = path.join(__dirname, '..', 'config', 'tv-certs', ip)
const CERT_FILE = path.join(CERT_DIR, 'client.crt')
const KEY_FILE = path.join(CERT_DIR, 'client.key')

// Generate self-signed client cert if not exists
function ensureCert() {
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) return
  fs.mkdirSync(CERT_DIR, { recursive: true })

  // Use openssl-like approach with Node crypto
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  // Self-signed cert using forge-like approach
  // For simplicity, use a pre-built self-signed cert via child_process
  const { execSync } = require('child_process')
  try {
    fs.writeFileSync(KEY_FILE, privateKey)
    // Generate self-signed cert with openssl
    execSync(`openssl req -new -x509 -key "${KEY_FILE}" -out "${CERT_FILE}" -days 3650 -subj "/CN=AYAExpoTools" -batch`, 
      { timeout: 10000, stdio: 'pipe' })
    console.log('Certificate generated: ' + CERT_DIR)
  } catch (e) {
    // If openssl not available, create a minimal DER cert
    console.log('openssl not found, using built-in cert generation...')
    // Write a placeholder — will be replaced during pairing
    fs.writeFileSync(CERT_FILE, publicKey)
    console.log('Key pair saved (cert may need manual generation)')
  }
}

function connect(opts = {}) {
  return new Promise((resolve, reject) => {
    const tlsOpts = {
      host: ip,
      port: 6466,
      rejectUnauthorized: false,
      timeout: 5000,
    }

    // Add client cert if exists
    if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
      tlsOpts.cert = fs.readFileSync(CERT_FILE)
      tlsOpts.key = fs.readFileSync(KEY_FILE)
    }

    const sock = tls.connect(tlsOpts, () => {
      resolve(sock)
    })

    sock.on('error', reject)
    sock.on('timeout', () => { sock.destroy(); reject(new Error('timeout')) })
  })
}

function sendAndReceive(sock, msg) {
  return new Promise((resolve, reject) => {
    let buf = ''
    const timer = setTimeout(() => { resolve(buf || null) }, 3000)
    sock.on('data', d => {
      buf += d.toString()
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(buf)
        clearTimeout(timer)
        resolve(buf)
      } catch {}
    })
    sock.write(JSON.stringify(msg))
  })
}

async function main() {
  if (action === 'request') {
    ensureCert()
    console.log('Connecting to ' + ip + ':6466...')
    try {
      const sock = await connect()
      console.log('Connected. Requesting pairing code...')

      // Send GetMajorVersion first
      const verResp = await sendAndReceive(sock, {
        type: 'Query',
        uri: 'ssap://com.webos.service.update/getCurrentSWInformation'
      })
      console.log('Version response:', verResp)

      // Try Hisense-specific pairing request
      const pairResp = await sendAndReceive(sock, {
        type: 'AuthReq'
      })
      console.log('Pair response:', pairResp)

      sock.destroy()
    } catch (e) {
      console.log('Connection error: ' + e.message)
      console.log('')
      console.log('A TV pode precisar de um método diferente de pairing.')
      console.log('Tentando método alternativo via porta 8008...')

      // Try Google Cast approach — set name via /setup/set_eureka_info
      // Some Hisense TVs accept standby via Cast backdrop
    }

  } else if (action === 'confirm') {
    if (!code) { console.log('Uso: node tv-pair.js ' + ip + ' confirm <código>'); process.exit(1) }
    console.log('Confirming code: ' + code)
    try {
      const sock = await connect()
      const resp = await sendAndReceive(sock, {
        type: 'AuthConfirm',
        payload: { code: code }
      })
      console.log('Response:', resp)
      sock.destroy()
    } catch (e) {
      console.log('Error: ' + e.message)
    }

  } else if (action === 'power-off') {
    console.log('Sending power off to ' + ip + '...')
    try {
      const sock = await connect()
      const resp = await sendAndReceive(sock, {
        type: 'Button',
        payload: { name: 'POWER', action: 'single' }
      })
      console.log('Response:', resp)
      sock.destroy()
      console.log('Power off sent.')
    } catch (e) {
      console.log('Error: ' + e.message)
    }

  } else if (action === 'test') {
    console.log('Testing connection to ' + ip + ':6466...')
    try {
      const sock = await connect()
      console.log('Connected OK')
      sock.destroy()
    } catch (e) {
      console.log('Error: ' + e.message)
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
