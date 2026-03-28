$status = Get-Content "C:\aya-expo-tools\cv\output\counter\status.json" | ConvertFrom-Json
Write-Output ("Status: " + $status.status + " PID: " + $status.pid)

$count = Get-Content "C:\aya-expo-tools\cv\output\counter\count.json" | ConvertFrom-Json
Write-Output ("entries: " + $count.entries + " exits: " + $count.exits)

# Check server.log for warm start messages
Get-Content "C:\aya-expo-tools\server.log" | Select-Object -Last 50 |
    Where-Object { $_ -match "Warm start|Counter|Restored|entries|starting fresh" }
