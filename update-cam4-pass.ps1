$configPath = "C:\aya-expo-tools\config\beleza-astral.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json

$cam4 = $config.cameras | Where-Object { $_.id -eq "cam-4" }
$cam4.password = "Abcd1234#!"
Write-Output "cam-4 senha atualizada"

$content = $config | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($configPath, $content, $utf8NoBom)
Write-Output "Salvo."
