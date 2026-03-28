$targets = @(201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215)
foreach ($last in $targets) {
    $ip = "192.168.0.$last"
    $ping = Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue
    if ($ping) {
        $rtsp = Test-NetConnection -ComputerName $ip -Port 554 -InformationLevel Quiet -WarningAction SilentlyContinue
        if ($rtsp) { Write-Output "$ip CAMERA" }
        else { Write-Output "$ip other" }
    }
}
Write-Output "done"
