$autoLogin = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" -Name AutoAdminLogon -ErrorAction SilentlyContinue).AutoAdminLogon
$autoUser = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" -Name DefaultUserName -ErrorAction SilentlyContinue).DefaultUserName
Write-Host "AutoLogin: $autoLogin | User: $autoUser"

$tasks = Get-ScheduledTask | Where-Object { $_.TaskName -match "resolume|arena|avenue|aya" }
Write-Host "Tasks: $(($tasks | ForEach-Object { $_.TaskName + '=' + $_.State }) -join ', ')"

$startupPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$startup = Get-ChildItem $startupPath -ErrorAction SilentlyContinue
Write-Host "Startup folder: $(($startup.Name) -join ', ')"

$run = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -ErrorAction SilentlyContinue
$runItems = $run.PSObject.Properties | Where-Object { $_.Name -notlike "PS*" }
Write-Host "Registry Run: $(($runItems | ForEach-Object { $_.Name }) -join ', ')"
