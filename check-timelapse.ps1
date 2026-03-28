$date = "2026-03-20"
$cams = @("cam-1", "cam-2", "cam-3")

foreach ($cam in $cams) {
    $frames = Get-ChildItem "D:\aya-expo-data\timelapse\$date\$cam\*.jpg" -ErrorAction SilentlyContinue | Sort-Object Name
    $total = $frames.Count
    
    # Frames entre 14:00 e 17:00 local (HHMMSS)
    $period = $frames | Where-Object { $_.BaseName -ge "140000" -and $_.BaseName -le "170000" }
    
    Write-Output "$cam : total=$total  14h-17h=$($period.Count)"
    if ($period.Count -gt 0) {
        Write-Output "  primeiro: $($period[0].Name)  ultimo: $($period[-1].Name)"
    }
}
