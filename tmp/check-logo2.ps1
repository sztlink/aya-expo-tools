$code = Get-Content "C:\aya-expo-tools\server\cv-report-html.js" -Raw

# Find getLogoBase64 function
$fnIdx = $code.IndexOf("getLogoBase64")
Write-Output "=== getLogoBase64 ==="
Write-Output $code.Substring($fnIdx, [Math]::Min(400, $code.Length-$fnIdx))

# Find where logo is used in HTML template
$filterIdx = $code.IndexOf("filter")
Write-Output "=== filter usage ==="
if ($filterIdx -ge 0) {
    Write-Output $code.Substring([Math]::Max(0,$filterIdx-100), [Math]::Min(300, $code.Length-$filterIdx))
} else {
    Write-Output "filter not found in code"
}

# Find img with logo
$imgLogoIdx = $code.IndexOf("logo}")
Write-Output "=== logo in template ==="
if ($imgLogoIdx -ge 0) {
    Write-Output $code.Substring([Math]::Max(0,$imgLogoIdx-100), [Math]::Min(200, $code.Length-$imgLogoIdx))
} else {
    Write-Output "dollar-logo-brace not found"
}
