# Check per-application audio sessions using AudioDeviceCmdlets or SndVol
# Use PowerShell to get audio sessions
try {
    $sessions = Get-AudioSession -ErrorAction Stop
    foreach ($s in $sessions) {
        Write-Output "$($s.ProcessId) $($s.Name) Vol=$($s.Volume) Mute=$($s.Mute)"
    }
} catch {
    Write-Output "AudioDeviceCmdlets not available"
    # Fallback: check which processes have audio
    $procs = Get-Process | Where-Object { $_.Modules -match 'AudioSes|mmdevapi|wdmaud' -or $_.ProcessName -match 'Arena|node|chrome|edge' }
    $procs | Select Id, ProcessName | Format-Table
}
