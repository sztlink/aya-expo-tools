param(
  [string]$Root = 'C:\aya-expo-tools',
  [string]$TaskName = 'AYA Expo Tools',
  [int]$FailureThreshold = 3,
  [int]$HeartbeatMaxAgeSeconds = 45,
  [int]$CooldownMinutes = 10,
  [int]$MaxRestartsPerHour = 3
)

$ErrorActionPreference = 'Stop'
$stateDir = Join-Path $Root 'state'
$statePath = Join-Path $stateDir 'runtime-watchdog.json'
$maintenanceLock = Join-Path $stateDir 'maintenance.lock'
$logPath = Join-Path $Root 'logs\runtime-watchdog.log'
$healthUrl = 'http://127.0.0.1:3000/api/runtime/live'
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path $logPath) -Force | Out-Null

function Rotate-Log {
  if ((Test-Path $logPath) -and (Get-Item $logPath).Length -gt 5MB) {
    $archive = "$logPath.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Move-Item $logPath $archive -Force
    Get-ChildItem "${logPath}.*" -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -Skip 5 |
      Remove-Item -Force -ErrorAction SilentlyContinue
  }
}

function Log([string]$Message) {
  "$(Get-Date -Format o) $Message" | Out-File -FilePath $logPath -Append -Encoding ascii
}

function New-State {
  [pscustomobject]@{
    consecutiveFailures = 0
    lastFailureAt = $null
    lastFailure = $null
    lastHealthyAt = $null
    lastRestartAt = $null
    restartCount = 0
    restartHistory = @()
  }
}

function Load-State {
  if (-not (Test-Path $statePath)) { return New-State }
  try {
    $state = Get-Content -Raw $statePath | ConvertFrom-Json
    foreach ($name in @('consecutiveFailures','lastFailureAt','lastFailure','lastHealthyAt','lastRestartAt','restartCount','restartHistory')) {
      if ($null -eq $state.$name) { $state | Add-Member -NotePropertyName $name -NotePropertyValue (New-State).$name -Force }
    }
    return $state
  } catch {
    Log "STATE_RESET parse_error=$($_.Exception.Message)"
    return New-State
  }
}

function Save-State($State) {
  $temp = "$statePath.tmp"
  $State | ConvertTo-Json -Depth 4 | Set-Content -Path $temp -Encoding ascii
  Move-Item $temp $statePath -Force
}

function Test-Runtime {
  try {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    if ($task.State -ne 'Running') { throw "task_state=$($task.State)" }

    $live = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5 -Method Get
    if ($live.status -ne 'alive') { throw "http_status=$($live.status)" }
    $expectedReleasePath = Join-Path $Root 'state\expected-release.txt'
    if (Test-Path $expectedReleasePath) {
      $expectedRelease = (Get-Content -Raw $expectedReleasePath).Trim()
      if ($expectedRelease -and $live.release -ne $expectedRelease) { throw "release_mismatch=$($live.release)!=$expectedRelease" }
    }
    if ($live.ready -ne $true) { throw "runtime_not_ready=$($live.readinessErrors -join ',')" }
    if ($null -eq $live.heartbeatAgeMs) { throw 'heartbeat_missing' }
    if ([double]$live.heartbeatAgeMs -gt ($HeartbeatMaxAgeSeconds * 1000)) {
      throw "heartbeat_stale_ms=$($live.heartbeatAgeMs)"
    }
    return [pscustomobject]@{ ok = $true; detail = "pid=$($live.pid) heartbeat_ms=$($live.heartbeatAgeMs) release=$($live.release)" }
  } catch {
    return [pscustomobject]@{ ok = $false; detail = $_.Exception.Message }
  }
}

function Restart-CanonicalTask {
  Log "RESTART_BEGIN task=$TaskName"
  try { Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue } catch {}
  Start-Sleep -Seconds 3

  # Kill only the process trees owned by this installation. Never kill by image name.
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
  foreach ($proc in $owned) {
    try {
      & taskkill.exe /F /T /PID $proc.ProcessId 2>&1 | Out-Null
      Log "KILL_OWNED pid=$($proc.ProcessId)"
    } catch {
      Log "KILL_WARN pid=$($proc.ProcessId) error=$($_.Exception.Message)"
    }
  }

  Start-ScheduledTask -TaskName $TaskName
}

Rotate-Log
$state = Load-State

if (Test-Path $maintenanceLock) {
  Log 'SKIP maintenance_lock=true'
  exit 0
}

$check = Test-Runtime
if ($check.ok) {
  if ([int]$state.consecutiveFailures -gt 0) { Log "RECOVERED $($check.detail)" }
  $state.consecutiveFailures = 0
  $state.lastFailure = $null
  $state.lastHealthyAt = (Get-Date).ToString('o')
  Save-State $state
  exit 0
}

$state.consecutiveFailures = [int]$state.consecutiveFailures + 1
$state.lastFailureAt = (Get-Date).ToString('o')
$state.lastFailure = $check.detail
Log "FAIL count=$($state.consecutiveFailures)/$FailureThreshold detail=$($check.detail)"
Save-State $state

if ([int]$state.consecutiveFailures -lt $FailureThreshold) { exit 0 }

if ($state.lastRestartAt) {
  try {
    $elapsed = [datetimeoffset]::Now - [datetimeoffset]::Parse($state.lastRestartAt)
    if ($elapsed.TotalMinutes -lt $CooldownMinutes) {
      Log "SKIP cooldown=true elapsed_min=$([math]::Round($elapsed.TotalMinutes,1))"
      exit 0
    }
  } catch { # malformed timestamp does not block recovery
  }
}

$oneHourAgo = [datetimeoffset]::Now.AddHours(-1)
$history = @($state.restartHistory | Where-Object {
  try { [datetimeoffset]::Parse([string]$_) -ge $oneHourAgo } catch { $false }
})
$state.restartHistory = $history
if ($history.Count -ge $MaxRestartsPerHour) {
  Save-State $state
  Log "CIRCUIT_OPEN restarts_last_hour=$($history.Count) max=$MaxRestartsPerHour"
  exit 1
}

try {
  Restart-CanonicalTask
  $state.lastRestartAt = (Get-Date).ToString('o')
  $state.restartCount = [int]$state.restartCount + 1
  $state.restartHistory = @($history + $state.lastRestartAt)
  $state.consecutiveFailures = 0
  Save-State $state
  Start-Sleep -Seconds 15

  $post = Test-Runtime
  if ($post.ok) {
    $state.lastHealthyAt = (Get-Date).ToString('o')
    $state.lastFailure = $null
    Save-State $state
    Log "RESTART_OK $($post.detail)"
    exit 0
  }

  $state.consecutiveFailures = 1
  $state.lastFailureAt = (Get-Date).ToString('o')
  $state.lastFailure = $post.detail
  Save-State $state
  Log "RESTART_FAILED detail=$($post.detail)"
  exit 1
} catch {
  $state.lastFailure = "restart_error=$($_.Exception.Message)"
  Save-State $state
  Log "RESTART_ERROR $($_.Exception.Message)"
  exit 1
}
