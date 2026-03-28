Write-Output "=== Task Scheduler ==="
Get-ScheduledTask | Where-Object { $_.TaskName -match 'AYA|expo|node|server|chrome|browser' } | Select-Object TaskName, State | Format-Table -AutoSize

Write-Output "=== Startup folder (usuario) ==="
Get-ChildItem "C:\Users\AYA\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup" -ErrorAction SilentlyContinue | Select-Object Name

Write-Output "=== Startup folder (todos) ==="
Get-ChildItem "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup" -ErrorAction SilentlyContinue | Select-Object Name

Write-Output "=== Registry Run ==="
Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -ErrorAction SilentlyContinue
Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" -ErrorAction SilentlyContinue
