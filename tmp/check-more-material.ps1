$base = 'D:\aya-expo-data'
$date = '2026-03-20'
$start = 144500
$end = 170000

Write-Output '=== Busca por mais material ==='

$roots = @(
  "D:\aya-expo-data\timelapse\$date",
  "D:\aya-expo-data",
  "C:\aya-expo-tools"
)

foreach ($root in $roots) {
  if (Test-Path $root) {
    Write-Output "`n--- ROOT: $root ---"
    Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object {
        $_.Extension -match '^\.(jpg|jpeg|png|mp4|avi|mov|mkv)$' -and (
          $_.Name -match '^(\d{6})\.' -or
          $_.DirectoryName -match 'cam-[1234]'
        )
      } |
      Select-Object FullName, Length |
      Format-Table -AutoSize
  }
}

Write-Output "`n=== Contagem por camera no timelapse ==="
$tlRoot = "D:\aya-expo-data\timelapse\$date"
if (Test-Path $tlRoot) {
  Get-ChildItem $tlRoot -Directory | ForEach-Object {
    $cam = $_.Name
    $files = Get-ChildItem $_.FullName -File -Include *.jpg,*.jpeg -ErrorAction SilentlyContinue |
      Where-Object {
        if ($_.BaseName -match '^(\d{6})$') {
          $t = [int]$matches[1]
          $t -ge $start -and $t -le $end
        } else { $false }
      }
    $first = $files | Select-Object -First 1
    $last  = $files | Select-Object -Last 1
    [PSCustomObject]@{
      Camera = $cam
      Count  = $files.Count
      First  = if ($first) { $first.BaseName } else { '' }
      Last   = if ($last) { $last.BaseName } else { '' }
    }
  } | Format-Table -AutoSize
}

Write-Output "`n=== Procura por videos longos no dia ==="
Get-ChildItem -Path 'D:\aya-expo-data' -Recurse -File -Include *.mp4,*.avi,*.mov,*.mkv -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match '2026-03-20|cam-[1234]|timelapse|record|video' } |
  Select-Object FullName, @{N='MB';E={[math]::Round($_.Length/1MB,1)}} |
  Format-Table -AutoSize
