$ErrorActionPreference = "SilentlyContinue"

Set-Content "C:\aya-expo-tools\start-server.ps1" "Set-Location C:\aya-expo-tools`nnode server/index.js"

Unregister-ScheduledTask -TaskName "AYA Expo Tools" -Confirm:$false

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -File C:\aya-expo-tools\start-server.ps1"
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -ExecutionTimeLimit 0
$principal = New-ScheduledTaskPrincipal -UserId "$env:COMPUTERNAME\aya" -LogonType Interactive -RunLevel Highest

Register-ScheduledTask -TaskName "AYA Expo Tools" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force

Start-ScheduledTask -TaskName "AYA Expo Tools"
Start-Sleep -Seconds 4

$state = (Get-ScheduledTask -TaskName "AYA Expo Tools").State
Write-Host "Task: $state"

$node = Get-Process -Name node -ErrorAction SilentlyContinue
if ($node) { Write-Host "node.exe OK PID=$($node.Id)" } else { Write-Host "node.exe NOT FOUND" }
