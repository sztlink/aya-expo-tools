Write-Output "=== INTERFACES ==="
Get-NetIPConfiguration | Select-Object InterfaceAlias, IPv4Address, IPv4DefaultGateway, DNSServer | Format-List

Write-Output "=== ROUTES ==="
Get-NetRoute -AddressFamily IPv4 | Where-Object { $_.DestinationPrefix -eq "0.0.0.0/0" } | Select-Object InterfaceAlias, NextHop, RouteMetric | Format-Table

Write-Output "=== PING GATEWAY ==="
Test-NetConnection -ComputerName 192.168.0.1 -InformationLevel Detailed | Select-Object ComputerName, PingSucceeded, PingReplyDetails

Write-Output "=== PING DNS CLOUDFLARE ==="
Test-NetConnection -ComputerName 1.1.1.1 -InformationLevel Quiet

Write-Output "=== PING DNS GOOGLE ==="
Test-NetConnection -ComputerName 8.8.8.8 -InformationLevel Quiet
