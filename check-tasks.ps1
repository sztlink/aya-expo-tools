$tasks = @("AYA Expo Tools", "AYA Expo Tools - Browser")
foreach ($name in $tasks) {
    $t = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    if ($t) {
        Write-Output "=== $name ==="
        Write-Output "State: $($t.State)"
        Write-Output "Trigger: $($t.Triggers | ConvertTo-Json -Compress)"
        Write-Output "Action: $($t.Actions | Select-Object Execute, Arguments | ConvertTo-Json -Compress)"
        Write-Output ""
    }
}

Write-Output "=== Startup shortcut ==="
$lnk = "C:\Users\AYA\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\BelezaAstral - Atalho.lnk"
if (Test-Path $lnk) {
    $sh = New-Object -ComObject WScript.Shell
    $s = $sh.CreateShortcut($lnk)
    Write-Output "Target: $($s.TargetPath)"
    Write-Output "Args: $($s.Arguments)"
}
