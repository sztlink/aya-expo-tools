# Assign static IP to Ethernet 2 (the one with the cable)
$adapter = "Ethernet 2"
$ip      = "192.168.0.10"
$mask    = "255.255.255.0"
$gw      = "192.168.0.1"
$dns     = @("8.8.8.8", "1.1.1.1")

Write-Output "Configuring $adapter with $ip..."

# Remove any existing IP on this adapter
$existing = Get-NetIPAddress -InterfaceAlias $adapter -AddressFamily IPv4 -ErrorAction SilentlyContinue
if ($existing) {
    Remove-NetIPAddress -InterfaceAlias $adapter -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue
}

# Remove existing gateway
Remove-NetRoute -InterfaceAlias $adapter -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue

# Set static IP
New-NetIPAddress -InterfaceAlias $adapter -IPAddress $ip -PrefixLength 24 -DefaultGateway $gw

# Set DNS
Set-DnsClientServerAddress -InterfaceAlias $adapter -ServerAddresses $dns

Start-Sleep -Seconds 3

Write-Output "Testing gateway..."
$ping = Test-NetConnection -ComputerName $gw -InformationLevel Quiet
Write-Output "Gateway $gw reachable: $ping"

Write-Output "Testing internet..."
$inet = Test-NetConnection -ComputerName "1.1.1.1" -InformationLevel Quiet
Write-Output "Internet reachable: $inet"

Get-NetIPConfiguration -InterfaceAlias $adapter | Select-Object InterfaceAlias, IPv4Address, IPv4DefaultGateway
