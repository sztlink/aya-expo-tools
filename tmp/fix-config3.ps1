$path = "C:\aya-expo-tools\config\beleza-astral.json"
$content = Get-Content $path -Raw -Encoding UTF8
$obj = $content | ConvertFrom-Json

if (-not $obj.exhibition.publicName) {
    Add-Member -InputObject $obj.exhibition -MemberType NoteProperty -Name publicName -Value "" -Force
}
if (-not $obj.exhibition.artist) {
    Add-Member -InputObject $obj.exhibition -MemberType NoteProperty -Name artist -Value "" -Force
}
if (-not $obj.exhibition.floor) {
    Add-Member -InputObject $obj.exhibition -MemberType NoteProperty -Name floor -Value "" -Force
}

$obj.exhibition.publicName = "Samuel de Saboia - Introducao ao Infinito"
$obj.exhibition.artist = "Samuel de Saboia"
$obj.exhibition.city = "Sao Paulo"
$obj.exhibition.floor = "22 andar"

$newJson = $obj | ConvertTo-Json -Depth 20
$newJson | Out-File $path -Encoding UTF8 -NoNewline

Write-Host "Atualizado:"
Write-Host "  publicName:" $obj.exhibition.publicName
Write-Host "  city:" $obj.exhibition.city
Write-Host "  artist:" $obj.exhibition.artist
Write-Host "  floor:" $obj.exhibition.floor
