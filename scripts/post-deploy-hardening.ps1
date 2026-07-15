param([string]$Root = 'C:\aya-expo-tools')

$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$receiptDir = Join-Path $Root "backup\post-hardening-$stamp"
New-Item -ItemType Directory -Path $receiptDir -Force | Out-Null

$aclOutput = & (Join-Path $Root 'scripts\harden-runtime-acls.ps1') -Root $Root -BackupDir (Join-Path $receiptDir 'acls')
$windowsOutput = & (Join-Path $Root 'scripts\configure-exhibition-windows.ps1') -ActiveHoursStart 7 -ActiveHoursEnd 23 -BackupDir $receiptDir

$live = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/runtime/live' -Method Get -TimeoutSec 10
if ($live.status -ne 'alive' -or $live.ready -ne $true) {
  throw "Runtime failed after hardening: $($live | ConvertTo-Json -Compress -Depth 5)"
}
$taskLog = Get-WinEvent -ListLog 'Microsoft-Windows-TaskScheduler/Operational'
if (-not $taskLog.IsEnabled) { throw 'Task Scheduler Operational log is disabled' }

@{
  completedAt = (Get-Date).ToString('o')
  acl = @($aclOutput)
  windows = @($windowsOutput)
  runtime = $live
  taskSchedulerOperationalEnabled = $taskLog.IsEnabled
} | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $receiptDir 'receipt.json') -Encoding ascii

Write-Output "AMANO_POST_HARDENING_OK backup=$receiptDir"
