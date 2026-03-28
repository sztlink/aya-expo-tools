$taskName = "AYA-TL3-Heatmap"
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
$action   = New-ScheduledTaskAction -Execute "C:\aya-expo-tools\tmp\run-timelapse-v3.bat"
$trigger  = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(5)
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 20)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Output "Task iniciada: $taskName"
Start-Sleep -Seconds 4
Write-Output "Estado: $((Get-ScheduledTask -TaskName $taskName).State)"
