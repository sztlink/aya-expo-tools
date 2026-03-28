$code = Get-Content "C:\aya-expo-tools\server\cv-report-html.js" -Raw
# Find the logo img in the template
$imgIdx = $code.IndexOf("alt=`"AYA`"")
if ($imgIdx -lt 0) { $imgIdx = $code.IndexOf("alt='AYA'") }
if ($imgIdx -lt 0) { $imgIdx = $code.IndexOf('"AYA"') }
Write-Output ("img-AYA at idx: " + $imgIdx)
if ($imgIdx -ge 0) {
    Write-Output $code.Substring([Math]::Max(0,$imgIdx-200), [Math]::Min(400, $code.Length-$imgIdx))
}
