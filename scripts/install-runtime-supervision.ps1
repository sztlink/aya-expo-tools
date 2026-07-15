param(
  [string]$Root = 'C:\aya-expo-tools',
  [string]$MainTaskName = 'AYA Expo Tools',
  [string]$WatchdogTaskName = 'AYA Expo Runtime Watchdog',
  [string]$BackupDir = ''
)

$ErrorActionPreference = 'Stop'
if (-not $BackupDir) {
  $BackupDir = Join-Path $Root ("backup\runtime-supervision-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
}
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

$main = Get-ScheduledTask -TaskName $MainTaskName -ErrorAction Stop
Export-ScheduledTask -TaskName $MainTaskName |
  Out-File (Join-Path $BackupDir 'AYA-Expo-Tools.before.xml') -Encoding utf8
if (Get-ScheduledTask -TaskName $WatchdogTaskName -ErrorAction SilentlyContinue) {
  Export-ScheduledTask -TaskName $WatchdogTaskName |
    Out-File (Join-Path $BackupDir 'AYA-Expo-Runtime-Watchdog.before.xml') -Encoding utf8
}

# Crash recovery belongs to Task Scheduler; functional hangs belong to the watchdog.
$mainSettings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit ([timespan]::Zero) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -MultipleInstances IgnoreNew
$mainLauncher = Join-Path $Root 'scripts\start-observed.cmd'
$mainConfig = Join-Path $Root 'config\template-amano-brasilia.json'
if (-not (Test-Path $mainLauncher)) { throw "Main launcher missing: $mainLauncher" }
if (-not (Test-Path $mainConfig)) { throw "Main config missing: $mainConfig" }
$mainAction = New-ScheduledTaskAction -Execute $mainLauncher -Argument 'template-amano-brasilia'
$mainTrigger = New-ScheduledTaskTrigger -AtStartup
$mainPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $MainTaskName -Action $mainAction -Trigger $mainTrigger -Principal $mainPrincipal -Settings $mainSettings -Force | Out-Null

$watchdogScript = Join-Path $Root 'scripts\runtime-watchdog.ps1'
if (-not (Test-Path $watchdogScript)) { throw "Watchdog script missing: $watchdogScript" }
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$watchdogScript`" -Root `"$Root`" -TaskName `"$MainTaskName`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$watchdogSettings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
  -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $WatchdogTaskName -Action $action -Trigger $trigger -Principal $principal -Settings $watchdogSettings -Force | Out-Null

# Enable durable task history for post-incident diagnosis.
& wevtutil.exe sl 'Microsoft-Windows-TaskScheduler/Operational' /e:true
if ($LASTEXITCODE -ne 0) { throw "Failed to enable Task Scheduler Operational log: $LASTEXITCODE" }

$installedMain = Get-ScheduledTask -TaskName $MainTaskName
if ($installedMain.Actions.Execute -ne $mainLauncher -or $installedMain.Actions.Arguments -ne 'template-amano-brasilia') {
  throw 'Main task action validation failed'
}
if ($installedMain.Principal.UserId -notin @('SYSTEM', 'S-1-5-18')) { throw 'Main task principal validation failed' }
if (-not ($installedMain.Triggers | Where-Object { $_.CimClass.CimClassName -eq 'MSFT_TaskBootTrigger' })) {
  throw 'Main task boot trigger validation failed'
}
$installedWatchdog = Get-ScheduledTask -TaskName $WatchdogTaskName
if ($installedWatchdog.Actions.Execute -ne 'powershell.exe') { throw 'Watchdog task action validation failed' }

@(
  "installed=$(Get-Date -Format o)"
  "mainTask=$MainTaskName"
  "watchdogTask=$WatchdogTaskName"
  "backup=$BackupDir"
) | Set-Content (Join-Path $BackupDir 'runtime-supervision.receipt.txt') -Encoding ascii

Write-Output "RUNTIME_SUPERVISION_INSTALLED backup=$BackupDir"
