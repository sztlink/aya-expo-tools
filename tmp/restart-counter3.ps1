$status = Get-Content "C:\aya-expo-tools\cv\output\counter\status.json" -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($status) { Stop-Process -Id $status.pid -Force -ErrorAction SilentlyContinue }
Start-Sleep 45
$status2 = Get-Content "C:\aya-expo-tools\cv\output\counter\status.json" | ConvertFrom-Json
Write-Output ("Status: " + $status2.status + " PID: " + $status2.pid)
$count = Get-Content "C:\aya-expo-tools\cv\output\counter\count.json" | ConvertFrom-Json
Write-Output ("entries: " + $count.entries + " exits: " + $count.exits)
