Write-Output "=== err.log (last 30) ==="
if (Test-Path "C:\aya-expo-tools\err.log") {
    Get-Content "C:\aya-expo-tools\err.log" | Select-Object -Last 30
} else { Write-Output "no err.log" }

Write-Output "=== server.log health/poll (last 20) ==="
Get-Content "C:\aya-expo-tools\server.log" | Select-Object -Last 100 |
    Where-Object { $_ -match "health|poll|GPU|disk|getDisk|Error" } |
    Select-Object -Last 20
