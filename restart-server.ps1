Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Set-Location C:\aya-expo-tools
Start-Process -FilePath "node" -ArgumentList "server/index.js","--config=beleza-astral" -WindowStyle Hidden
Start-Sleep -Seconds 3
$proc = Get-Process node -ErrorAction SilentlyContinue
if ($proc) { Write-Output "OK: node PID $($proc.Id)" } else { Write-Output "FAIL: node not running" }
