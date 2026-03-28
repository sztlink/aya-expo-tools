/**
 * AYA Expo Tools — Audio (Windows Master Volume)
 *
 * Controla o volume master do Windows via Core Audio API (PowerShell).
 * Não gerencia player — o Resolume faz isso. Só controla o volume de saída.
 */

const { execSync, exec } = require('child_process')
const fs = require('fs')
const path = require('path')

// Script PowerShell para controlar volume via Core Audio API
const PS_SCRIPT = path.join(__dirname, '..', 'scripts', 'audio-volume.ps1')

// Escreve o script na primeira inicialização (sempre sobrescreve para garantir versão correta)
function ensureScript() {
  const dir = path.dirname(PS_SCRIPT)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(PS_SCRIPT, VOLUME_SCRIPT, 'utf8')
}

const VOLUME_SCRIPT = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'audio-volume.ps1'), 'utf8')

let _cachedVolume = null

function runVolumeScript(action, level = 0) {
  ensureScript()
  const args = action === 'set'
    ? `-Action set -Level ${level}`
    : `-Action get`
  const cmd = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${PS_SCRIPT}" ${args}`
  try {
    const out = execSync(cmd, { timeout: 5000, windowsHide: true }).toString().trim()
    const parsed = parseInt(out)
    if (!isNaN(parsed)) return parsed
    console.error(`[Audio] Script returned: ${out}`)
    return null
  } catch (e) {
    console.error(`[Audio] Error: ${e.message}`)
    return null
  }
}

function getVolume() {
  const v = runVolumeScript('get')
  if (v !== null) _cachedVolume = v
  return _cachedVolume ?? 80
}

function setVolume(level) {
  const clamped = Math.max(0, Math.min(100, Math.round(level)))
  const result = runVolumeScript('set', clamped)
  if (result !== null) _cachedVolume = clamped
  return _cachedVolume ?? clamped
}

module.exports = { getVolume, setVolume }
