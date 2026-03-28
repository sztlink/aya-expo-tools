[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$path = "C:\aya-expo-tools\config\beleza-astral.json"
$content = Get-Content $path -Raw -Encoding UTF8
$obj = $content | ConvertFrom-Json

$obj.exhibition.publicName = "Samuel de Saboia - Introducao ao Infinito"
$obj.exhibition.artist = "Samuel de Saboia"
$obj.exhibition.city = "Sao Paulo"
$obj.exhibition.floor = "22 andar"

$newJson = $obj | ConvertTo-Json -Depth 20
$newJson | Out-File $path -Encoding UTF8 -NoNewline
Write-Host "Config atualizado"
Write-Host "publicName:" $obj.exhibition.publicName
Write-Host "city:" $obj.exhibition.city
