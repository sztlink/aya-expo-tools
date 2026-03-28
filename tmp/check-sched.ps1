$cfg = [System.IO.File]::ReadAllText("C:\aya-expo-tools\config\beleza-astral.json", [System.Text.Encoding]::UTF8) | ConvertFrom-Json
Write-Output ("schedule.enabled: " + $cfg.schedule.enabled)
Write-Output ("schedule.timezone: " + $cfg.schedule.timezone)
Write-Output ("schedule.days.thu: " + ($cfg.schedule.days.thu | ConvertTo-Json -Compress))
