$unknowns = @("192.168.0.126", "192.168.0.184")
$plugPorts = @(6668, 6669, 9999, 80, 443)

Write-Output "=== Smart plug ports ==="
foreach ($ip in $unknowns) {
    Write-Output "--- $ip ---"
    foreach ($port in $plugPorts) {
        $r = Test-NetConnection -ComputerName $ip -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
        if ($r) { Write-Output "OPEN $port" }
    }
}

Write-Output ""
Write-Output "=== Novos dispositivos na rede ==="
$toCheck = @(115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 127, 128, 129, 130, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 220, 225, 230, 240, 250, 251, 252, 253, 254)
foreach ($last in $toCheck) {
    $ip = "192.168.0.$last"
    $ping = Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue
    if ($ping) {
        $rtsp = Test-NetConnection -ComputerName $ip -Port 554 -InformationLevel Quiet -WarningAction SilentlyContinue
        $http = Test-NetConnection -ComputerName $ip -Port 80 -InformationLevel Quiet -WarningAction SilentlyContinue
        if ($rtsp) {
            Write-Output "$ip RTSP+HTTP"
        } elseif ($http) {
            Write-Output "$ip HTTP-only"
        } else {
            Write-Output "$ip ping-only"
        }
    }
}
Write-Output "done"
