$status = Get-Content "C:\aya-expo-tools\cv\output\counter\status.json" | ConvertFrom-Json
Stop-Process -Id $status.pid -Force -ErrorAction SilentlyContinue
Start-Sleep 2
Write-Output "Done"
