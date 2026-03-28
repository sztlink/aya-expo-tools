$status = Get-Content "C:\aya-expo-tools\cv\output\counter\status.json" | ConvertFrom-Json
$cpid = $status.pid
Write-Output "Counter PID: $cpid"
Stop-Process -Id $cpid -Force -ErrorAction SilentlyContinue
Start-Sleep 2
$countFile = "C:\aya-expo-tools\cv\output\counter\count.json"
$zero = "{`"entries`":0,`"exits`":0,`"occupancy`":0,`"activeTrackers`":0,`"activeVisitors`":0,`"dwellTime`":null,`"hourly`":{},`"date`":`"2026-03-26`",`"timestamp`":`"2026-03-26T13:40:00.000000+00:00`"}"
[System.IO.File]::WriteAllText($countFile, $zero)
Write-Output "Zeroed OK"
Start-Sleep 12
Get-Content $countFile
