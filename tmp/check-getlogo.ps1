$code = Get-Content "C:\aya-expo-tools\server\cv-report-html.js" -Raw
$idx = $code.IndexOf("function getLogoBase64")
Write-Output "=== getLogoBase64 ==="
Write-Output $code.Substring($idx, [Math]::Min(200, $code.Length-$idx))

# Check LOGO_BASE64 constant
$constIdx = $code.IndexOf("const LOGO_BASE64")
Write-Output "`n=== LOGO_BASE64 constant ==="
if ($constIdx -ge 0) {
    Write-Output ("Found at idx " + $constIdx)
    Write-Output $code.Substring($constIdx, [Math]::Min(80, $code.Length-$constIdx))
} else {
    Write-Output "NOT FOUND"
}
