Remove-NetIPAddress -InterfaceAlias "Ethernet 2" -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue
Remove-NetRoute -InterfaceAlias "Ethernet 2" -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue
Set-NetIPInterface -InterfaceAlias "Ethernet 2" -Dhcp Enabled -ErrorAction SilentlyContinue
Write-Output "Ethernet 2 limpa."
