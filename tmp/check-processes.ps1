# What does tasklist return for Arena?
$output = & tasklist /FI "IMAGENAME eq Arena.exe" /FO CSV /NH 2>&1
Write-Output "tasklist output:"
Write-Output $output

# Also check raw process name
$proc = Get-Process Arena -ErrorAction SilentlyContinue
Write-Output ("Get-Process name: " + $proc.Name)
Write-Output ("Get-Process MainModule: " + $proc.MainModule.ModuleName)
