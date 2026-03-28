# Check logo file
$logoPath = "C:\aya-expo-tools\public\logo-aya.png"
Write-Output ("logo exists: " + (Test-Path $logoPath))
if (Test-Path $logoPath) {
    Write-Output ("logo size: " + (Get-Item $logoPath).Length + " bytes")
}

# Check what the report-html.js does with logo
$code = Get-Content "C:\aya-expo-tools\server\cv-report-html.js" -Raw
$logoIdx = $code.IndexOf("logo")
Write-Output ("logo in code at idx: " + $logoIdx)
Write-Output $code.Substring([Math]::Max(0,$logoIdx-50), [Math]::Min(300, $code.Length-$logoIdx))
