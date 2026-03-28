$code = Get-Content "C:\aya-expo-tools\server\index.js" -Raw
$idx = $code.IndexOf("serverHealth.start")
Write-Output ("serverHealth.start found: " + ($idx -ge 0) + " at idx: " + $idx)
if ($idx -ge 0) {
    Write-Output $code.Substring([Math]::Max(0,$idx-150), 350)
}

# Also check if there's an error in startup
$log = Get-Content "C:\aya-expo-tools\server.log" | Select-Object -Last 30
$log | Where-Object { $_ -match "error|Error|ERR|start|health" }
