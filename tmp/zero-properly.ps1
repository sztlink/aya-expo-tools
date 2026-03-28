# List all python processes with workingset
Write-Output "=== Python processes ==="
Get-Process python | Select-Object Id, WorkingSet | Format-Table -AutoSize

# Kill the counter (WorkingSet between 80-120MB — smaller than detectors ~150MB)
$counter = Get-Process python | Where-Object { $_.WorkingSet -gt 70000000 -and $_.WorkingSet -lt 120000000 }
foreach ($p in $counter) {
    Write-Output ("Killing counter candidate PID " + $p.Id + " WS=" + [math]::Round($p.WorkingSet/1MB,1) + "MB")
    Stop-Process -Id $p.Id -Force
}

Start-Sleep 3

# Now zero the count.json while counter is stopped
$countFile = "C:\aya-expo-tools\cv\output\counter\count.json"
$zero = '{"entries":0,"exits":0,"occupancy":0,"activeTrackers":0,"activeVisitors":0,"dwellTime":null,"hourly":{},"date":"2026-03-26","timestamp":"2026-03-26T13:30:00.000000+00:00"}'
[System.IO.File]::WriteAllText($countFile, $zero)
Write-Output ("Zeroed: " + [System.IO.File]::ReadAllText($countFile).Substring(0,40))

Write-Output "Node.js will restart counter automatically"
