$path = 'C:\aya-expo-tools\config\beleza-astral.json'
$bak = $path + '.bak-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
Copy-Item $path $bak -Force

$config = Get-Content $path -Raw | ConvertFrom-Json

# TV-1: new Ethernet IP and MAC
$tv1 = $config.tvs | Where-Object { $_.id -eq 'tv-1' }
$oldIp1 = $tv1.ip
$oldMac1 = $tv1.mac
$tv1.ip = '192.168.0.202'
$tv1.mac = 'C4:08:26:9A:E7:EB'

Write-Output "TV-1: $oldIp1 ($oldMac1) -> 192.168.0.202 (C4:08:26:9A:E7:EB)"

# TV-2: verify (keep if unchanged)
$tv2 = $config.tvs | Where-Object { $_.id -eq 'tv-2' }
Write-Output "TV-2: $($tv2.ip) ($($tv2.mac)) -> sem alteracao"

$config | ConvertTo-Json -Depth 10 | Set-Content $path -Encoding UTF8
Write-Output "Config atualizada. Backup: $bak"
