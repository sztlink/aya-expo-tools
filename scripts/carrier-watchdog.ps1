# AYA Expo Tools - Carrier Watchdog
# Relanca o carrier (start-carrier.cmd) se ele cair. Roda a cada 1 min via Task
# Scheduler (ver install-carrier-watchdog.bat). Sem isso, se o carrier morrer
# (crash, reboot, ou Ctrl+C no console acertando o node) a agenda do projetor e o
# portal sync somem SILENCIOSO -- foi o que aconteceu por ~3 dias em jun/2026.
#
# Deteccao: porta 3100 ouvindo OU processo node do carrier vivo. O check de
# processo cobre o boot (o node leva ~10-15s pra ligar o 3100), evitando relancar
# em duplicidade enquanto sobe.
#
# Relanca lancando o start-carrier.cmd DIRETO (Start-Process), NUNCA via
# schtasks /run -- chamar schtasks /run de dentro do contexto da task watchdog e
# recusado pelo Windows (0x800710E0). O carrier e headless (node server), nao
# precisa de sessao interativa.
$ErrorActionPreference = "SilentlyContinue"
$root = "C:\aya-expo-tools-player1"
$log  = Join-Path $root "logs\carrier-watchdog.log"
function CarrierUp {
    $port = (Get-NetTCPConnection -State Listen -LocalPort 3100 -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0
    if ($port) { return $true }
    $proc = (Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*player1-farol*' } | Measure-Object).Count -gt 0
    return $proc
}
if (CarrierUp) { exit 0 }
Start-Sleep -Seconds 8
if (CarrierUp) { exit 0 }
$ts  = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$cmd = Join-Path $root "start-carrier.cmd"
Add-Content -Path $log -Value "$ts WATCHDOG: carrier fora do ar (porta 3100 + node) por >8s; relancando start-carrier.cmd"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$cmd`"" -WorkingDirectory $root -WindowStyle Hidden
