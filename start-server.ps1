Set-Location C:\aya-expo-tools
$logPath = "C:\aya-expo-tools\server.log"
$errPath = "C:\aya-expo-tools\err.log"

while ($true) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content $logPath "[$timestamp] Iniciando servidor..."

    $proc = Start-Process -FilePath "node" `
        -ArgumentList "server/index.js" `
        -WorkingDirectory "C:\aya-expo-tools" `
        -RedirectStandardOutput $logPath `
        -RedirectStandardError $errPath `
        -PassThru -NoNewWindow

    $proc.WaitForExit()
    $exitCode = $proc.ExitCode
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content $logPath "[$timestamp] Servidor saiu com codigo $exitCode. Reiniciando em 10s..."
    Start-Sleep -Seconds 10
}
