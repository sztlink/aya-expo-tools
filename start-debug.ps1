Set-Location C:\aya-expo-tools
# Try starting and capture any error
try {
    $proc = Start-Process -FilePath "node" -ArgumentList "server/index.js","--config=beleza-astral" -WindowStyle Hidden -PassThru
    Start-Sleep -Seconds 5
    if ($proc.HasExited) {
        Write-Output "EXITED with code: $($proc.ExitCode)"
    } else {
        Write-Output "OK: PID $($proc.Id)"
    }
} catch {
    Write-Output "ERROR: $_"
}
# Also check if json is valid
try {
    $null = Get-Content C:\aya-expo-tools\config\beleza-astral.json -Raw | ConvertFrom-Json
    Write-Output "Config JSON: valid"
} catch {
    Write-Output "Config JSON: INVALID - $_"
}
