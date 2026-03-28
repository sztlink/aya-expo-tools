$regPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
Set-ItemProperty $regPath -Name "AutoAdminLogon" -Value "1"
Set-ItemProperty $regPath -Name "DefaultUserName" -Value "aya"
Set-ItemProperty $regPath -Name "DefaultDomainName" -Value "$env:COMPUTERNAME"
Remove-ItemProperty $regPath -Name "DefaultPassword" -ErrorAction SilentlyContinue
Write-Host "Auto-login configurado sem senha."
