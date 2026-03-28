Write-Output "=== Rota default (saida de internet) ==="
Get-NetRoute -AddressFamily IPv4 | Where-Object { $_.DestinationPrefix -eq "0.0.0.0/0" } | Select-Object InterfaceAlias, NextHop, RouteMetric | Format-Table -AutoSize

Write-Output "=== IPs das interfaces ==="
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "169.*" } | Select-Object InterfaceAlias, IPAddress | Format-Table -AutoSize

Write-Output "=== Qual interface chega em 8.8.8.8 ==="
Find-NetRoute -RemoteIPAddress "8.8.8.8" | Select-Object InterfaceAlias, LocalAddress, NextHop | Format-Table -AutoSize
