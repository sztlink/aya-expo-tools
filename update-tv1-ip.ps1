$configPath = "C:\aya-expo-tools\config\beleza-astral.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json

$tv = $config.tvs | Where-Object { $_.id -eq "tv-1" }
$old = $tv.ip
$tv.ip = "192.168.0.115"

$content = $config | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($configPath, $content, $utf8NoBom)

Write-Output "TV-1: $old -> 192.168.0.115"
Write-Output "OK"
