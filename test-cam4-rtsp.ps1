$ip = "192.168.0.200"
$port = 554

# Verificar porta 554 aberta
$rtsp = Test-NetConnection -ComputerName $ip -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
Write-Output "Porta 554 aberta: $rtsp"

# Verificar porta 80
$http = Test-NetConnection -ComputerName $ip -Port 80 -InformationLevel Quiet -WarningAction SilentlyContinue
Write-Output "Porta 80 aberta: $http"

# Tentar HTTP para ver interface web
if ($http) {
    try {
        $r = Invoke-WebRequest -Uri "http://$ip" -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
        Write-Output "HTTP status: $($r.StatusCode)"
        Write-Output "HTTP content (primeiros 200 chars): $($r.Content.Substring(0, [Math]::Min(200, $r.Content.Length)))"
    } catch {
        Write-Output "HTTP erro: $_"
    }
}

# Tentar RTSP com diferentes senhas via ffprobe (se instalado)
$ffprobe = "C:\aya-expo-tools\ffmpeg\bin\ffprobe.exe"
if (Test-Path $ffprobe) {
    $creds = @("admin:ac00ac00ac00ac", "admin:admin", "admin:", "admin:12345")
    foreach ($cred in $creds) {
        $url = "rtsp://$cred@${ip}:554/cam/realmonitor?channel=1&subtype=0"
        Write-Output "Testando: $cred"
        $result = & $ffprobe -v quiet -print_format json -show_streams $url 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Output "  SUCESSO com: $cred"
            break
        } else {
            Write-Output "  FALHOU"
        }
    }
} else {
    Write-Output "ffprobe nao encontrado"
}
