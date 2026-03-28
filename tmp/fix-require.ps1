$indexPath = "C:\aya-expo-tools\server\index.js"
$code = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)

# Find where other cv modules are required
$cvReportIdx = $code.IndexOf("require('./cv-report')")
Write-Output ("cv-report require at: " + $cvReportIdx)

if ($cvReportIdx -ge 0) {
    # Insert cv-notify require right after cv-report require line
    $lineEnd = $code.IndexOf("`n", $cvReportIdx)
    $before = $code.Substring(0, $lineEnd + 1)
    $after = $code.Substring($lineEnd + 1)
    $newLine = "const cvNotify = require('./cv-notify');`n"
    $code = $before + $newLine + $after
    Write-Output "Inserted: const cvNotify = require('./cv-notify')"
} else {
    Write-Output "cv-report require not found - searching for cv-logger..."
    $cvLogIdx = $code.IndexOf("require('./cv-logger')")
    if ($cvLogIdx -ge 0) {
        $lineEnd = $code.IndexOf("`n", $cvLogIdx)
        $before = $code.Substring(0, $lineEnd + 1)
        $after = $code.Substring($lineEnd + 1)
        $code = $before + "const cvNotify = require('./cv-notify');`n" + $after
        Write-Output "Inserted after cv-logger"
    }
}

[System.IO.File]::WriteAllText($indexPath, $code, [System.Text.Encoding]::UTF8)
Write-Output "Done"

# Verify
$verify = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)
$idx = $verify.IndexOf("require('./cv-notify')")
Write-Output ("Verify: cv-notify require at " + $idx)
