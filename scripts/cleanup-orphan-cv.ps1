param([string]$Root = 'C:\aya-expo-tools')

$ErrorActionPreference = 'SilentlyContinue'
try { $Root = (Resolve-Path $Root).Path.TrimEnd('\') } catch {}
$rootPattern = [regex]::Escape($Root)
$owner = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -ieq 'node.exe' -and $_.CommandLine -and $_.CommandLine -match "$rootPattern\\index\.js"
}
if ($owner) { exit 0 }

$orphans = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -match '^python(w)?\.exe$' -and $_.CommandLine -and
  $_.CommandLine -match "$rootPattern\\clusters\\cv\\python\\(detector|reid|counter)\.py"
}
foreach ($proc in $orphans) {
  & taskkill.exe /F /T /PID $proc.ProcessId 2>&1 | Out-Null
}
if ($orphans) {
  "$(Get-Date -Format o) ORPHAN_CV_CLEANUP count=$($orphans.Count)" |
    Out-File (Join-Path $Root 'logs\runtime-watchdog.log') -Append -Encoding ascii
}
