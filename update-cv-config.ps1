# Read config, update CV params, write back
$configPath = "C:\aya-expo-tools\config\beleza-astral.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json

# Lower confidence for better detection of distant/partially occluded people
$config.cv.confidence = 0.3

# Add imgsz — 960 for better detection on 1080p cameras (vs default 640)
$config.cv | Add-Member -NotePropertyName "imgsz" -NotePropertyValue 960 -Force

# Write back
$config | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding UTF8
Write-Output "Config updated: confidence=0.3, imgsz=960"
