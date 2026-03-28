$status = Get-Content "C:\aya-expo-tools\cv\output\counter\status.json" | ConvertFrom-Json
$cpid = $status.pid
Write-Output ("Killing counter PID: " + $cpid)
Stop-Process -Id $cpid -Force -ErrorAction SilentlyContinue
Start-Sleep 3
Write-Output "Done"
