param([Parameter(Mandatory = $true)][string]$BackupDir)

$ErrorActionPreference = 'Stop'
$journalPath = Join-Path $BackupDir 'deploy-journal.json'
if (-not (Test-Path $journalPath)) { throw "Deploy journal missing: $journalPath" }
$journal = Get-Content -Raw $journalPath | ConvertFrom-Json
$Root = [string]$journal.root
$MainTaskName = [string]$journal.mainTaskName
$WatchdogTaskName = [string]$journal.watchdogTaskName
$filesBackup = Join-Path $BackupDir 'files'
$maintenanceLock = Join-Path $Root 'state\maintenance.lock'

function Assert-SafeRelative([string]$Relative) {
  if ([string]::IsNullOrWhiteSpace($Relative) -or [System.IO.Path]::IsPathRooted($Relative)) { throw "Unsafe journal path: $Relative" }
  $normalized = $Relative.Replace('/', '\')
  if ($normalized.Split('\') | Where-Object { $_ -in @('', '.', '..') }) { throw "Unsafe journal path: $Relative" }
  $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
  $targetFull = [System.IO.Path]::GetFullPath((Join-Path $Root $normalized))
  if (-not $targetFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Journal path escapes root: $Relative" }
  return $normalized
}

New-Item -ItemType Directory -Path (Split-Path $maintenanceLock) -Force | Out-Null
"manual-rollback started=$(Get-Date -Format o)" | Set-Content $maintenanceLock -Encoding ascii

try {
  Stop-ScheduledTask -TaskName $WatchdogTaskName -ErrorAction SilentlyContinue
  Stop-ScheduledTask -TaskName $MainTaskName -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3
  $rootPattern = [regex]::Escape($Root)
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and (
      ($_.Name -ieq 'node.exe' -and ($_.CommandLine -match "$rootPattern\\scripts\\runtime-launcher\.js" -or $_.CommandLine -match "$rootPattern\\index\.js")) -or
      ($_.Name -match '^python(w)?\.exe$' -and $_.CommandLine -match "$rootPattern\\clusters\\cv\\python\\(detector|reid|counter)\.py")
    )
  } | ForEach-Object { & taskkill.exe /F /T /PID $_.ProcessId 2>&1 | Out-Null }

  $created = @($journal.createdFiles)
  $seenPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($rawRelative in @($journal.files)) {
    $relative = Assert-SafeRelative ([string]$rawRelative)
    if (-not $seenPaths.Add($relative)) { throw "Duplicate journal path: $relative" }
    $backup = Join-Path $filesBackup $relative
    $target = Join-Path $Root $relative
    if (Test-Path $backup) {
      New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
      Copy-Item $backup $target -Force
    } elseif ($relative -in $created -and (Test-Path $target)) {
      Remove-Item $target -Force
    }
  }

  $expectedReleasePath = Join-Path $Root 'state\expected-release.txt'
  $expectedReleaseBackup = Join-Path $BackupDir 'expected-release.before.txt'
  if ($journal.expectedReleaseExisted -and (Test-Path $expectedReleaseBackup)) {
    Copy-Item $expectedReleaseBackup $expectedReleasePath -Force
  } elseif (Test-Path $expectedReleasePath) {
    Remove-Item $expectedReleasePath -Force
  }

  if ($journal.legacyLogsMoved) {
    foreach ($name in @('stdout.log', 'stderr.log')) {
      $archived = Join-Path $BackupDir "legacy-logs\$name"
      $target = Join-Path $Root "logs\$name"
      if (Test-Path $archived) { Move-Item $archived $target -Force }
    }
  }

  $mainXml = Get-Content -Raw (Join-Path $BackupDir 'main-task.before.xml')
  Register-ScheduledTask -TaskName $MainTaskName -Xml $mainXml -Force | Out-Null
  if ($journal.watchdogExisted) {
    $watchdogXml = Get-Content -Raw (Join-Path $BackupDir 'watchdog-task.before.xml')
    Register-ScheduledTask -TaskName $WatchdogTaskName -Xml $watchdogXml -Force | Out-Null
  } else {
    Disable-ScheduledTask -TaskName $WatchdogTaskName -ErrorAction SilentlyContinue | Out-Null
  }
  Start-ScheduledTask -TaskName $MainTaskName

  $journal.stage = 'rolled-back-manual'
  $journal.updatedAt = (Get-Date).ToString('o')
  $journalTemp = "$journalPath.tmp"
  $journal | ConvertTo-Json -Depth 6 | Set-Content $journalTemp -Encoding ascii
  Move-Item $journalTemp $journalPath -Force
  Remove-Item $maintenanceLock -Force
  Write-Output "AMANO_RESILIENCE_ROLLBACK_OK backup=$BackupDir"
} catch {
  # Keep maintenance.lock in place so the watchdog cannot interfere with recovery.
  throw
}
