$cams = @("cam-1", "cam-2", "cam-3")
foreach ($cam in $cams) {
    Write-Output "=== $cam ==="
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000/api/cv/$cam/detections" -UseBasicParsing
        Write-Output $r.Content
    } catch {
        Write-Output "ERROR: $_"
    }
}
Write-Output "=== CV STATUS ==="
$s = Invoke-WebRequest -Uri "http://localhost:3000/api/cv/status" -UseBasicParsing
Write-Output $s.Content
