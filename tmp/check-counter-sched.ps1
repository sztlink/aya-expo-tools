# Test reading the config the same way Python does
$raw = [System.IO.File]::ReadAllText("C:\aya-expo-tools\config\beleza-astral.json", [System.Text.Encoding]::UTF8)
$cfg = $raw | ConvertFrom-Json
Write-Output ("schedule type: " + $cfg.schedule.GetType().Name)
Write-Output ("enabled value: " + $cfg.schedule.enabled)
Write-Output ("enabled type: " + $cfg.schedule.enabled.GetType().Name)

# Check actual schedule section in raw JSON
$raw | Select-String '"schedule"' -Context 0,5 | Select-Object -First 1
