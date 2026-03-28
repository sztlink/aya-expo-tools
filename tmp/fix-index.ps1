$code = Get-Content "C:\aya-expo-tools\server\index.js" -Raw

# Check if cv-notify is required at top
$requireIdx = $code.IndexOf("require('./cv-notify')")
Write-Output ("cv-notify require at: " + $requireIdx)
if ($requireIdx -ge 0) {
    Write-Output $code.Substring([Math]::Max(0,$requireIdx-50), 100)
}

# Check where cvNotify is used
$useIdx = $code.IndexOf("cvNotify.start")
Write-Output ("cvNotify.start at: " + $useIdx)
if ($useIdx -ge 0) {
    Write-Output $code.Substring([Math]::Max(0,$useIdx-100), 200)
}

$stopIdx = $code.IndexOf("cvNotify.stop")
Write-Output ("cvNotify.stop at: " + $stopIdx)
