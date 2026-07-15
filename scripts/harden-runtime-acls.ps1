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

& icacls.exe $Root /save $aclBackup /t /c | Out-File $aclBefore -Encoding ascii
if ($LASTEXITCODE -ne 0) { throw "ACL backup failed with exit code $LASTEXITCODE" }

# Scheduled scripts run as SYSTEM. Local operators administer through the
# Administrators group. Regular users may read/execute code but cannot mutate it.
& icacls.exe $Root /inheritance:r /t /c | Out-File $aclAfter -Encoding ascii
if ($LASTEXITCODE -ne 0) { throw "ACL inheritance hardening failed with exit code $LASTEXITCODE" }
& icacls.exe $Root /remove:g '*S-1-5-11' '*S-1-1-0' /t /c | Out-File $aclAfter -Append -Encoding ascii
if ($LASTEXITCODE -ne 0) { throw "ACL unsafe-principal removal failed with exit code $LASTEXITCODE" }
& icacls.exe $Root /grant:r '*S-1-5-18:(OI)(CI)(F)' '*S-1-5-32-544:(OI)(CI)(F)' '*S-1-5-32-545:(OI)(CI)(RX)' /t /c |
  Out-File $aclAfter -Append -Encoding ascii
if ($LASTEXITCODE -ne 0) { throw "ACL grants failed with exit code $LASTEXITCODE" }

# Secrets/configs are readable only by SYSTEM and Administrators.
$sensitive = @(
  (Join-Path $Root '.env'),
  (Join-Path $Root 'config'),
  (Join-Path $Root 'wg-config'),
  (Join-Path $Root 'backup')
)
foreach ($target in $sensitive) {
  if (-not (Test-Path $target)) { continue }
  if ((Get-Item $target).PSIsContainer) {
    & icacls.exe $target /inheritance:r /remove:g '*S-1-5-11' '*S-1-1-0' '*S-1-5-32-545' /grant:r '*S-1-5-18:(OI)(CI)(F)' '*S-1-5-32-544:(OI)(CI)(F)' /t /c |
      Out-File $aclAfter -Append -Encoding ascii
  } else {
    & icacls.exe $target /inheritance:r /remove:g '*S-1-5-11' '*S-1-1-0' '*S-1-5-32-545' /grant:r '*S-1-5-18:(F)' '*S-1-5-32-544:(F)' /c |
      Out-File $aclAfter -Append -Encoding ascii
  }
  if ($LASTEXITCODE -ne 0) { throw "Sensitive ACL hardening failed: $target" }
}

$criticalCode = @(
  (Join-Path $Root 'index.js'),
  (Join-Path $Root 'scripts\start-observed.cmd'),
  (Join-Path $Root 'scripts\runtime-launcher.js'),
  (Join-Path $Root 'scripts\runtime-watchdog.ps1'),
  (Join-Path $Root 'scripts\cleanup-orphan-cv.ps1')
)
foreach ($target in $criticalCode) {
  if (-not (Test-Path $target)) { continue }
  & icacls.exe $target /inheritance:r /grant:r '*S-1-5-18:(F)' '*S-1-5-32-544:(F)' '*S-1-5-32-545:(RX)' /c |
    Out-File $aclAfter -Append -Encoding ascii
  if ($LASTEXITCODE -ne 0) { throw "Critical executable ACL hardening failed: $target" }
}

$allowedSensitiveSids = @('S-1-5-18', 'S-1-5-32-544')
$validationTargets = @($sensitive + @(
  (Join-Path $Root 'config\template-amano-brasilia.json'),
  (Join-Path $Root 'wg-config\amano-rio.conf')
)) | Select-Object -Unique
$validation = foreach ($target in $validationTargets) {
  if (-not (Test-Path $target)) { continue }
  $unexpected = @((Get-Acl $target).Access | Where-Object {
    try { $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin $allowedSensitiveSids }
    catch { $true }
  } | ForEach-Object { $_.IdentityReference.Value })
  [pscustomobject]@{ path = $target; unexpectedPrincipals = $unexpected }
}
$validation | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $BackupDir 'validation.json') -Encoding ascii
if ($validation | Where-Object { $_.unexpectedPrincipals.Count -gt 0 }) {
  throw 'ACL validation failed: a sensitive path has a non-admin principal'
}

$allowedCodeSids = @('S-1-5-18', 'S-1-5-32-544', 'S-1-5-32-545')
$codeValidation = foreach ($target in $criticalCode) {
  if (-not (Test-Path $target)) { continue }
  $unexpected = @((Get-Acl $target).Access | Where-Object {
    try { $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin $allowedCodeSids }
    catch { $true }
  } | ForEach-Object { $_.IdentityReference.Value })
  [pscustomobject]@{ path = $target; unexpectedPrincipals = $unexpected }
}
$codeValidation | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $BackupDir 'code-validation.json') -Encoding ascii
if ($codeValidation | Where-Object { $_.unexpectedPrincipals.Count -gt 0 }) {
  throw 'ACL validation failed: a critical executable has an unexpected principal'
}

Write-Output "RUNTIME_ACLS_HARDENED backup=$BackupDir"
Write-Output "Rollback from parent directory: icacls.exe . /restore `"$aclBackup`" /c"
