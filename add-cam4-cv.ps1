$configPath = "C:\aya-expo-tools\config\beleza-astral.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json

# Adicionar cam-4 ao CV
$currentCams = $config.cv.cameras
Write-Output "Cameras CV antes: $currentCams"

if ($currentCams -notcontains "cam-4") {
    $config.cv.cameras = $currentCams + "cam-4"
    Write-Output "cam-4 adicionada ao CV"
} else {
    Write-Output "cam-4 ja estava no CV"
}

Write-Output "Cameras CV depois: $($config.cv.cameras)"

$content = $config | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($configPath, $content, $utf8NoBom)
Write-Output "Salvo."
