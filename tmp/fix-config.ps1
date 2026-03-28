# fix-config.ps1 - Corrige publicName e encoding do city
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$path = "C:\aya-expo-tools\config\beleza-astral.json"
$json = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$obj = $json | ConvertFrom-Json

$obj.exhibition | Add-Member -MemberType NoteProperty -Name "publicName" -Value "Samuel de Saboia — Introdução ao Infinito" -Force
$obj.exhibition | Add-Member -MemberType NoteProperty -Name "artist" -Value "Samuel de Saboia" -Force
$obj.exhibition | Add-Member -MemberType NoteProperty -Name "city" -Value "São Paulo" -Force
$obj.exhibition | Add-Member -MemberType NoteProperty -Name "floor" -Value "22º andar" -Force

$newJson = $obj | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($path, $newJson, [System.Text.Encoding]::UTF8)
Write-Output ("publicName: " + $obj.exhibition.publicName)
Write-Output ("city: " + $obj.exhibition.city)
