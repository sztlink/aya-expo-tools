$configPath = "C:\aya-expo-tools\config\beleza-astral.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json

# Salvar device IDs e local key nos plugs 7 e 8
$plug7 = $config.smartplugs | Where-Object { $_.id -eq "plug-7" }
$plug8 = $config.smartplugs | Where-Object { $_.id -eq "plug-8" }

$plug7 | Add-Member -NotePropertyName "deviceId" -NotePropertyValue "eb7a4ea2c370d73f91ymo5" -Force
$plug7 | Add-Member -NotePropertyName "localKey" -NotePropertyValue "ac00ac00ac00ac" -Force

$plug8 | Add-Member -NotePropertyName "deviceId" -NotePropertyValue "eb9a38f4fa639284bcemvo" -Force
$plug8 | Add-Member -NotePropertyName "localKey" -NotePropertyValue "ac00ac00ac00ac" -Force

$content = $config | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($configPath, $content, $utf8NoBom)
Write-Output "plug-7 deviceId: $($plug7.deviceId)"
Write-Output "plug-8 deviceId: $($plug8.deviceId)"
Write-Output "Salvo."
