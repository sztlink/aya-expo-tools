# Check Resolume process
$arena = Get-Process | Where-Object { $_.Name -match "Arena|Resolume" }
if ($arena) {
    Write-Output ("Resolume running: " + ($arena | Select-Object -First 1 Name, Id | Format-Table -AutoSize | Out-String))
} else {
    Write-Output "Resolume NOT found in process list"
}

# Check config resolume section
$cfg = [System.IO.File]::ReadAllText("C:\aya-expo-tools\config\beleza-astral.json", [System.Text.Encoding]::UTF8) | ConvertFrom-Json
Write-Output ("Config resolume.process: " + $cfg.resolume.process)

# Check camera names
Write-Output "Camera names:"
$cfg.cameras | ForEach-Object { Write-Output ("  " + $_.id + ": " + $_.name) }
