$ips = @("192.168.0.126", "192.168.0.184")
$ports = @(80, 443, 554, 8000, 8080, 8443, 34567, 37777)

foreach ($ip in $ips) {
    Write-Output "=== $ip ==="
    foreach ($port in $ports) {
        $r = Test-NetConnection -ComputerName $ip -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
        if ($r) { Write-Output "  OPEN: $port" }
    }
}
