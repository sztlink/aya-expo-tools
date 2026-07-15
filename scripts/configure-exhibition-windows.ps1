param(
  [int]$ActiveHoursStart = 7,
  [int]$ActiveHoursEnd = 23,
  [string]$BackupDir = 'C:\aya-expo-tools\backup'
)

$ErrorActionPreference = 'Stop'
if ($ActiveHoursStart -lt 0 -or $ActiveHoursStart -gt 23 -or $ActiveHoursEnd -lt 0 -or $ActiveHoursEnd -gt 23) {
  throw 'Active hours must be between 0 and 23'
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$receiptDir = Join-Path $BackupDir "windows-exhibition-$stamp"
New-Item -ItemType Directory -Path $receiptDir -Force | Out-Null

$uxKey = 'HKLM\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings'
$policyKey = 'HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate'
$auKey = "$policyKey\AU"

function Invoke-Reg([string[]]$Arguments) {
  & reg.exe @Arguments | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "reg.exe failed ($LASTEXITCODE): $($Arguments -join ' ')" }
}

$policyExisted = $false
& reg.exe query $policyKey 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { $policyExisted = $true }

Invoke-Reg @('export', $uxKey, (Join-Path $receiptDir 'windows-update-ux-before.reg'), '/y')
if ($policyExisted) {
  Invoke-Reg @('export', $policyKey, (Join-Path $receiptDir 'windows-update-policy-before.reg'), '/y')
}

Invoke-Reg @('add', $uxKey, '/v', 'ActiveHoursStart', '/t', 'REG_DWORD', '/d', "$ActiveHoursStart", '/f')
Invoke-Reg @('add', $uxKey, '/v', 'ActiveHoursEnd', '/t', 'REG_DWORD', '/d', "$ActiveHoursEnd", '/f')
Invoke-Reg @('add', $policyKey, '/v', 'SetActiveHours', '/t', 'REG_DWORD', '/d', '1', '/f')
Invoke-Reg @('add', $policyKey, '/v', 'ActiveHoursStart', '/t', 'REG_DWORD', '/d', "$ActiveHoursStart", '/f')
Invoke-Reg @('add', $policyKey, '/v', 'ActiveHoursEnd', '/t', 'REG_DWORD', '/d', "$ActiveHoursEnd", '/f')
Invoke-Reg @('add', $auKey, '/v', 'NoAutoRebootWithLoggedOnUsers', '/t', 'REG_DWORD', '/d', '1', '/f')

$actualStart = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings').ActiveHoursStart
$actualEnd = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings').ActiveHoursEnd
$actualNoReboot = (Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU').NoAutoRebootWithLoggedOnUsers
if ($actualStart -ne $ActiveHoursStart -or $actualEnd -ne $ActiveHoursEnd -or $actualNoReboot -ne 1) {
  throw 'Windows Update policy validation failed'
}

$rollbackInstruction = if ($policyExisted) { 'import both .reg backups' } else { 'import UX backup and remove policy values/key created by this script' }
@{
  configuredAt = (Get-Date).ToString('o')
  policyKeyExistedBefore = $policyExisted
  activeHoursStart = $actualStart
  activeHoursEnd = $actualEnd
  noAutoRebootWithLoggedOnUsers = $actualNoReboot
  rollback = $rollbackInstruction
} | ConvertTo-Json | Set-Content (Join-Path $receiptDir 'receipt.json') -Encoding ascii

Write-Output "EXHIBITION_WINDOWS_CONFIGURED activeHours=${ActiveHoursStart}-${ActiveHoursEnd} backup=$receiptDir"
