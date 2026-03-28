# Test reading the logo file the same way Node does
$logoPath = "C:\aya-expo-tools\public\logo-aya.png"
$bytes = [System.IO.File]::ReadAllBytes($logoPath)
$b64 = [Convert]::ToBase64String($bytes)
Write-Output ("b64 length: " + $b64.Length)
Write-Output ("first 20 chars: " + $b64.Substring(0,20))

# Also check: does getLogoBase64 fail silently?
# Try calling the preview endpoint and check console output
$logPath = "C:\aya-expo-tools\server.log"
Get-Content $logPath | Select-Object -Last 20
