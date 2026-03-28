$path = "C:\aya-expo-tools\config\beleza-astral.json"
$cfg = Get-Content $path -Raw | ConvertFrom-Json
$cam4 = $cfg.cameras | Where-Object { $_.id -eq "cam-4" }
$cam4.password = "ac00ac00ac00ac"
$cfg | ConvertTo-Json -Depth 10 | Set-Content $path -Encoding UTF8
Write-Host "cam-4 password OK"
