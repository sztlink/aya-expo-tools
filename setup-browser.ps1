$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c start chrome http://localhost:3000"
$trigger = New-ScheduledTaskTrigger -AtLogon -User "aya"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:COMPUTERNAME\aya" -LogonType Interactive -RunLevel Limited

Unregister-ScheduledTask -TaskName "AYA Expo Tools - Browser" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "AYA Expo Tools - Browser" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force

Write-Host "OK - Chrome vai abrir localhost:3000 no login do usuario aya"
