param(
  [string]$Root = 'C:\aya-expo-tools',
  [string]$BackupDir = ''
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $Root)) { throw "Runtime root missing: $Root" }
if (-not $BackupDir) {
  $BackupDir = Join-Path $Root ("backup\acl-hardening-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
}
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

$aclBackup = Join-Path $BackupDir 'acl-before.txt'
$aclBefore = Join-Path $BackupDir 'icacls-before.txt'
$aclAfter = Join-Path $BackupDir 'icacls-after.txt'
$tempAclLog = Join-Path $env:TEMP ("aya-acl-hardening-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')

& icacls.exe $Root /save $aclBackup /t /c | Out-File $aclBefore -Encoding ascii
if ($LASTEXITCODE -ne 0) { throw "ACL backup failed with exit code $LASTEXITCODE" }

# Canonical root ACL first, then reset children so they inherit it. Do not run
# /inheritance:r recursively: that can strip access before replacement ACEs land.
& takeown.exe /F $Root /A /R /D Y 2>&1 | Out-File $tempAclLog -Encoding ascii
& icacls.exe $Root /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)(F)' '*S-1-5-32-544:(OI)(CI)(F)' '*S-1-5-32-545:(OI)(CI)(RX)' /c 2>&1 |
  Out-File $tempAclLog -Append -Encoding ascii
if ($LASTEXITCODE -ne 0) { throw "Root ACL failed with exit code $LASTEXITCODE" }
& icacls.exe (Join-Path $Root '*') /reset /t /c 2>&1 | Out-File $tempAclLog -Append -Encoding ascii
if ($LASTEXITCODE -ne 0) { throw "Child ACL reset failed with exit code $LASTEXITCODE" }

# Secrets/configs/backups inherit only SYSTEM + Administrators.
$sensitiveRoots = @(
  (Join-Path $Root 'config'),
  (Join-Path $Root 'wg-config'),
  (Join-Path $Root 'backup')
)
foreach ($target in $sensitiveRoots) {
  if (-not (Test-Path $target)) { continue }
  & icacls.exe $target /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)(F)' '*S-1-5-32-544:(OI)(CI)(F)' /c 2>&1 |
    Out-File $tempAclLog -Append -Encoding ascii
  if ($LASTEXITCODE -ne 0) { throw "Sensitive root ACL failed: $target" }
  & icacls.exe (Join-Path $target '*') /reset /t /c 2>&1 | Out-File $tempAclLog -Append -Encoding ascii
  if ($LASTEXITCODE -ne 0) { throw "Sensitive child ACL reset failed: $target" }
}
$envFile = Join-Path $Root '.env'
if (Test-Path $envFile) {
  & icacls.exe $envFile /inheritance:r /grant:r '*S-1-5-18:(F)' '*S-1-5-32-544:(F)' /c 2>&1 |
    Out-File $tempAclLog -Append -Encoding ascii
  if ($LASTEXITCODE -ne 0) { throw '.env ACL failed' }
}

$checks = @(
  @{ Path = $Root; Allowed = @('S-1-5-18','S-1-5-32-544','S-1-5-32-545') },
  @{ Path = (Join-Path $Root 'scripts'); Allowed = @('S-1-5-18','S-1-5-32-544','S-1-5-32-545') },
  @{ Path = (Join-Path $Root 'config'); Allowed = @('S-1-5-18','S-1-5-32-544') },
  @{ Path = (Join-Path $Root 'wg-config'); Allowed = @('S-1-5-18','S-1-5-32-544') },
  @{ Path = (Join-Path $Root 'backup'); Allowed = @('S-1-5-18','S-1-5-32-544') }
)
$validation = foreach ($check in $checks) {
  if (-not (Test-Path $check.Path)) { continue }
  $unexpected = @((Get-Acl $check.Path).Access | Where-Object {
    try { $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin $check.Allowed }
    catch { $true }
  } | ForEach-Object { $_.IdentityReference.Value })
  [pscustomobject]@{ path = $check.Path; unexpectedPrincipals = $unexpected }
}
$validation | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $BackupDir 'validation.json') -Encoding ascii
if ($validation | Where-Object { $_.unexpectedPrincipals.Count -gt 0 }) {
  throw 'ACL validation failed: unexpected principal remains'
}

Copy-Item $tempAclLog $aclAfter -Force
Remove-Item $tempAclLog -Force -ErrorAction SilentlyContinue
Write-Output "RUNTIME_ACLS_HARDENED backup=$BackupDir"
Write-Output "Rollback from parent directory: icacls.exe . /restore `"$aclBackup`" /c"
