# Encontrar ffprobe
$candidates = @(
    "C:\aya-expo-tools\ffmpeg\bin\ffprobe.exe",
    "C:\ffmpeg\bin\ffprobe.exe",
    "C:\ProgramData\chocolatey\bin\ffprobe.exe"
)
$ffprobe = $null
foreach ($p in $candidates) {
    if (Test-Path $p) { $ffprobe = $p; break }
}
if (-not $ffprobe) {
    $found = Get-Command ffprobe -ErrorAction SilentlyContinue
    if ($found) { $ffprobe = $found.Source }
}
Write-Output "ffprobe: $ffprobe"

if (-not $ffprobe) {
    Write-Output "Usando Python para testar RTSP"
    $py = "C:\aya-expo-tools\cv\venv\Scripts\python.exe"
    $creds = @("admin:ac00ac00ac00ac", "admin:admin", "admin:")
    foreach ($cred in $creds) {
        $url = "rtsp://$cred@192.168.0.200:554/cam/realmonitor?channel=1&subtype=0"
        $test = & $py -c "import cv2; cap=cv2.VideoCapture('$url', cv2.CAP_FFMPEG); cap.set(cv2.CAP_PROP_BUFFERSIZE,1); ret,_=cap.read(); cap.release(); print('OK' if ret else 'FAIL')" 2>&1
        Write-Output "${cred}: $test"
    }
} else {
    $creds = @("admin:ac00ac00ac00ac", "admin:admin", "admin:")
    foreach ($cred in $creds) {
        $url = "rtsp://$cred@192.168.0.200:554/cam/realmonitor?channel=1&subtype=0"
        $r = & $ffprobe -v quiet -show_streams $url 2>&1
        $ok = $LASTEXITCODE -eq 0
        Write-Output "${cred}: $(if($ok){'OK'}else{'FAIL'})"
    }
}
