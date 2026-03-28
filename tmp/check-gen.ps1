$code = Get-Content "C:\aya-expo-tools\server\cv-report-html.js" -Raw
# Find generateHTML function and first 800 chars
$idx = $code.IndexOf("function generateHTML")
if ($idx -ge 0) {
    Write-Output $code.Substring($idx, [Math]::Min(600, $code.Length-$idx))
}
