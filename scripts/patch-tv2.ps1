$path = 'C:\aya-expo-tools\config\beleza-astral.json'
$bak = $path + '.bak-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
Copy-Item $path $bak -Force

$raw = Get-Content $path -Raw
# Remove BOM if present
if ($raw[0] -eq [char]0xFEFF) { $raw = $raw.Substring(1) }
$config = $raw | ConvertFrom-Json

$tv2 = $config.tvs | Where-Object { $_.id -eq 'tv-2' }
$oldIp = $tv2.ip
$oldMac = $tv2.mac
$tv2.ip = '192.168.0.201'
$tv2.mac = 'C4:08:26:9A:E8:88'

Write-Output "TV-2: $oldIp ($oldMac) -> 192.168.0.201 (C4:08:26:9A:E8:88)"

$json = $config | ConvertTo-Json -Depth 10
# Write without BOM
[System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding $false))
Write-Output "Config atualizada."
