param(
  [Parameter(Mandatory = $true)][string]$PackageDir,
  [string]$Root = 'C:\aya-expo-tools',
  [string]$MainTaskName = 'AYA Expo Tools',
  [string]$WatchdogTaskName = 'AYA Expo Runtime Watchdog'
)

$ErrorActionPreference = 'Stop'
$manifestPath = Join-Path $PackageDir 'release.json'
if (-not (Test-Path $manifestPath)) { throw "Release manifest missing: $manifestPath" }
$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
if (-not $manifest.releaseId -or -not $manifest.files) { throw 'Invalid release manifest' }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $Root "backup\amano-resilience-$stamp"
$filesBackup = Join-Path $backupDir 'files'
$receiptPath = Join-Path $backupDir 'deploy-receipt.json'
$journalPath = Join-Path $backupDir 'deploy-journal.json'
$stateDir = Join-Path $Root 'state'
$maintenanceLock = Join-Path $stateDir 'maintenance.lock'
$expectedReleasePath = Join-Path $stateDir 'expected-release.txt'
$expectedReleaseBackup = Join-Path $backupDir 'expected-release.before.txt'
$legacyLogDir = Join-Path $backupDir 'legacy-logs'
$createdFiles = New-Object System.Collections.Generic.List[string]
$journalFiles = New-Object System.Collections.Generic.List[string]
$watchdogExisted = $false
$baselinePrepared = $false
$lockCreated = $false
$legacyLogsMoved = $false
$expectedReleaseExisted = $false

$receipt = [ordered]@{
  releaseId = $manifest.releaseId
  startedAt = (Get-Date).ToString('o')
  completedAt = $null
  status = 'started'
  backupDir = $backupDir
  files = 0
  readiness = $null
  error = $null
}

function Save-Journal([string]$Stage) {
  $journalTemp = "$journalPath.tmp"
  [ordered]@{
    schemaVersion = 1
    releaseId = $manifest.releaseId
    root = $Root
    backupDir = $backupDir
    mainTaskName = $MainTaskName
    watchdogTaskName = $WatchdogTaskName
    watchdogExisted = $watchdogExisted
    stage = $Stage
    updatedAt = (Get-Date).ToString('o')
    legacyLogsMoved = $legacyLogsMoved
    expectedReleaseExisted = $expectedReleaseExisted
    files = @($journalFiles)
    createdFiles = @($createdFiles)
  } | ConvertTo-Json -Depth 6 | Set-Content $journalTemp -Encoding ascii
  Move-Item $journalTemp $journalPath -Force
}

function Quiesce-Watchdog {
  $task = Get-ScheduledTask -TaskName $WatchdogTaskName -ErrorAction SilentlyContinue
  if (-not $task) { return }
  Stop-ScheduledTask -TaskName $WatchdogTaskName -ErrorAction SilentlyContinue
  $deadline = (Get-Date).AddSeconds(15)
  do {
    $state = (Get-ScheduledTask -TaskName $WatchdogTaskName -ErrorAction SilentlyContinue).State
    if ($state -ne 'Running') { return }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  throw "Watchdog task did not quiesce: $WatchdogTaskName"
}

function Assert-SafeRelative([string]$Relative) {
  if ([string]::IsNullOrWhiteSpace($Relative) -or [System.IO.Path]::IsPathRooted($Relative)) {
    throw "Unsafe manifest path: $Relative"
  }
  $normalized = $Relative.Replace('/', '\')
  if ($normalized.Split('\') | Where-Object { $_ -in @('', '.', '..') }) { throw "Unsafe manifest path: $Relative" }
  $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
  $targetFull = [System.IO.Path]::GetFullPath((Join-Path $Root $normalized))
  if (-not $targetFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Manifest path escapes runtime root: $Relative"
  }
  return $normalized
}

function Stop-OwnedRuntime {
  try { Stop-ScheduledTask -TaskName $MainTaskName -ErrorAction SilentlyContinue } catch {}
  Start-Sleep -Seconds 3
  $rootPattern = [regex]::Escape($Root)
  $owned = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and (
      ($_.Name -ieq 'node.exe' -and (
        $_.CommandLine -match "$rootPattern\\scripts\\runtime-launcher\.js" -or
        $_.CommandLine -match "$rootPattern\\index\.js"
      )) -or
      ($_.Name -match '^python(w)?\.exe$' -and
        $_.CommandLine -match "$rootPattern\\clusters\\cv\\python\\(detector|reid|counter)\.py")
    )
  }
  foreach ($proc in $owned) { & taskkill.exe /F /T /PID $proc.ProcessId 2>&1 | Out-Null }
}

function Test-Requirement([string]$Requirement) {
  foreach ($alternative in $Requirement.Split('|')) {
    $safe = Assert-SafeRelative $alternative
    if (Test-Path (Join-Path $Root $safe)) { return $true }
  }
  return $false
}

function Test-NewReadiness([int]$TimeoutSeconds = 120) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $last = $null
  while ((Get-Date) -lt $deadline) {
    try {
      $last = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/runtime/live' -Method Get -TimeoutSec 5
      if ($last.status -eq 'alive' -and $last.ready -eq $true -and $last.release -eq $manifest.releaseId) { return $last }
    } catch { $last = $_.Exception.Message }
    Start-Sleep -Seconds 3
  }
  throw "Readiness timeout: $($last | ConvertTo-Json -Compress -Depth 5)"
}

function Restore-Baseline {
  Stop-OwnedRuntime
  foreach ($relative in $journalFiles) {
    $backup = Join-Path $filesBackup $relative
    $target = Join-Path $Root $relative
    if (Test-Path $backup) {
      New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
      Copy-Item $backup $target -Force
    } elseif ($createdFiles.Contains($relative) -and (Test-Path $target)) {
      Remove-Item $target -Force
    }
  }
  if ($expectedReleaseExisted -and (Test-Path $expectedReleaseBackup)) {
    Copy-Item $expectedReleaseBackup $expectedReleasePath -Force
  } elseif (Test-Path $expectedReleasePath) {
    Remove-Item $expectedReleasePath -Force
  }
  if ($legacyLogsMoved) {
    foreach ($name in @('stdout.log', 'stderr.log')) {
      $archived = Join-Path $legacyLogDir $name
      $target = Join-Path $Root "logs\$name"
      if (Test-Path $archived) { Move-Item $archived $target -Force }
    }
  }
  if ($baselinePrepared) {
    $mainXml = Get-Content -Raw (Join-Path $backupDir 'main-task.before.xml')
    Register-ScheduledTask -TaskName $MainTaskName -Xml $mainXml -Force | Out-Null
    if ($watchdogExisted) {
      $watchdogXml = Get-Content -Raw (Join-Path $backupDir 'watchdog-task.before.xml')
      Register-ScheduledTask -TaskName $WatchdogTaskName -Xml $watchdogXml -Force | Out-Null
    } else {
      Disable-ScheduledTask -TaskName $WatchdogTaskName -ErrorAction SilentlyContinue | Out-Null
    }
    Start-ScheduledTask -TaskName $MainTaskName
  }
  Save-Journal 'rolled-back'
}

try {
  New-Item -ItemType Directory -Path $filesBackup -Force | Out-Null
  New-Item -ItemType Directory -Path $stateDir -Force | Out-Null

  # Verify package and host prerequisites before maintenance mode or process stop.
  $seenPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($file in $manifest.files) {
    $relative = Assert-SafeRelative ([string]$file.path)
    if (-not $seenPaths.Add($relative)) { throw "Duplicate manifest path: $relative" }
    $source = Join-Path $PackageDir $relative
    if (-not (Test-Path $source -PathType Leaf)) { throw "Package file missing: $relative" }
    $actual = (Get-FileHash -Algorithm SHA256 $source).Hash.ToLowerInvariant()
    if ($actual -ne ([string]$file.sha256).ToLowerInvariant()) { throw "Package hash mismatch: $relative" }
  }
  foreach ($requirement in @($manifest.runtimeRequirements)) {
    if (-not (Test-Requirement ([string]$requirement))) { throw "Runtime requirement missing: $requirement" }
  }

  $watchdogExisted = !!(Get-ScheduledTask -TaskName $WatchdogTaskName -ErrorAction SilentlyContinue)
  Export-ScheduledTask -TaskName $MainTaskName | Out-File (Join-Path $backupDir 'main-task.before.xml') -Encoding utf8
  if ($watchdogExisted) {
    Export-ScheduledTask -TaskName $WatchdogTaskName | Out-File (Join-Path $backupDir 'watchdog-task.before.xml') -Encoding utf8
  }
  $baselinePrepared = $true
  Save-Journal 'baseline-prepared'

  "deploy=$($manifest.releaseId) started=$(Get-Date -Format o)" | Set-Content $maintenanceLock -Encoding ascii
  $lockCreated = $true
  Save-Journal 'maintenance'
  Quiesce-Watchdog
  Stop-OwnedRuntime

  New-Item -ItemType Directory -Path $legacyLogDir -Force | Out-Null
  foreach ($name in @('stdout.log', 'stderr.log')) {
    $legacy = Join-Path $Root "logs\$name"
    if (Test-Path $legacy) { Move-Item $legacy (Join-Path $legacyLogDir $name) -Force; $legacyLogsMoved = $true }
  }
  Save-Journal 'legacy-logs-archived'

  foreach ($file in $manifest.files) {
    $relative = Assert-SafeRelative ([string]$file.path)
    $source = Join-Path $PackageDir $relative
    $target = Join-Path $Root $relative
    $backup = Join-Path $filesBackup $relative
    if (Test-Path $target) {
      New-Item -ItemType Directory -Path (Split-Path $backup) -Force | Out-Null
      Copy-Item $target $backup -Force
    } else { $createdFiles.Add($relative) }
    $journalFiles.Add($relative)
    Save-Journal "copying:$relative"
    New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
    Copy-Item $source $target -Force
    $targetHash = (Get-FileHash -Algorithm SHA256 $target).Hash.ToLowerInvariant()
    if ($targetHash -ne ([string]$file.sha256).ToLowerInvariant()) { throw "Target hash mismatch: $relative" }
  }

  $releaseTarget = Join-Path $Root 'release.json'
  $releaseBackup = Join-Path $filesBackup 'release.json'
  if (Test-Path $releaseTarget) { Copy-Item $releaseTarget $releaseBackup -Force }
  else { $createdFiles.Add('release.json') }
  $journalFiles.Add('release.json')
  Save-Journal 'copying:release.json'
  Copy-Item $manifestPath $releaseTarget -Force
  if (Test-Path $expectedReleasePath) {
    Copy-Item $expectedReleasePath $expectedReleaseBackup -Force
    $expectedReleaseExisted = $true
  }
  Save-Journal 'release-identity-backed-up'
  ([string]$manifest.releaseId) | Set-Content $expectedReleasePath -Encoding ascii
  Save-Journal 'release-identity-written'

  & (Join-Path $Root 'scripts\install-runtime-supervision.ps1') -Root $Root -MainTaskName $MainTaskName -WatchdogTaskName $WatchdogTaskName -BackupDir $backupDir | Out-Null
  Save-Journal 'supervision-installed'
  Start-ScheduledTask -TaskName $MainTaskName
  $ready = Test-NewReadiness

  $receipt.status = 'ready'
  $receipt.completedAt = (Get-Date).ToString('o')
  $receipt.files = $manifest.files.Count
  $receipt.readiness = $ready
  $receipt | ConvertTo-Json -Depth 8 | Set-Content $receiptPath -Encoding ascii
  Save-Journal 'ready'
  Remove-Item $maintenanceLock -Force
  $lockCreated = $false
  Write-Output "AMANO_RESILIENCE_DEPLOY_OK release=$($manifest.releaseId) backup=$backupDir"
} catch {
  $receipt.status = 'failed'
  $receipt.completedAt = (Get-Date).ToString('o')
  $receipt.error = $_.Exception.Message
  $rollbackSucceeded = -not $baselinePrepared
  if ($baselinePrepared) {
    try { Restore-Baseline; $receipt.status = 'rolled-back'; $rollbackSucceeded = $true }
    catch { $receipt.rollbackError = $_.Exception.Message; $rollbackSucceeded = $false }
  }
  try { $receipt | ConvertTo-Json -Depth 8 | Set-Content $receiptPath -Encoding ascii } catch {}
  if ($lockCreated -and $rollbackSucceeded) { Remove-Item $maintenanceLock -Force -ErrorAction SilentlyContinue }
  # If rollback failed, keep maintenance.lock so the watchdog cannot amplify a partial state.
  throw
}
