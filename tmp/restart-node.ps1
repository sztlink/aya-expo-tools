Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Write-Output "Node stopped - Task Scheduler will restart"
