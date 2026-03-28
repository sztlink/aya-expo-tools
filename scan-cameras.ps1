foreach ($last in 201..254) {
    $ip = "192.168.0.$last"
    $ping = Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue
    if ($ping) {
        $rtsp = Test-NetConnection -ComputerName $ip -Port 554 -InformationLevel Quiet -WarningAction SilentlyContinue
        $http = Test-NetConnection -ComputerName $ip -Port 80 -InformationLevel Quiet -WarningAction SilentlyContinue
        if ($rtsp) { Write-Output "$ip CAMERA-RTSP" }
        elseif ($http) { Write-Output "$ip HTTP" }
        else { Write-Output "$ip ping-only" }
    }
}
Write-Output "done"
