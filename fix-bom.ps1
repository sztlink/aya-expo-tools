$path = "C:\aya-expo-tools\config\beleza-astral.json"
$content = [System.IO.File]::ReadAllText($path)
# Remove BOM if present
if ($content[0] -eq [char]0xFEFF) {
    $content = $content.Substring(1)
}
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
Write-Output "BOM removed. File re-saved as UTF-8 no BOM."
