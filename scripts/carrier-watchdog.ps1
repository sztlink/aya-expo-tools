# AYA Expo Tools - Carrier Watchdog
# Relanca o carrier (start-carrier.cmd) se ele cair. Roda a cada 1 min via Task
# Scheduler (ver install-carrier-watchdog.bat). Sem isso, se o carrier morrer
# (crash, reboot, ou Ctrl+C no console acertando o node) a agenda do projetor e o
# portal sync somem SILENCIOSO -- foi o que aconteceu por ~3 dias em jun/2026.
#
# Deteccao: porta 3100 ouvindo = sinal DEFINITIVO de carrier servindo. NAO usar
# "existe node com player1-farol" como sinal de vida: um worker/orfao pode
# sobreviver sem o listener e dar falso-positivo (validado em jun/2026 -- o
# watchdog nao religava porque pegava um node orfao). O tick de 1 min e bem maior
# que o boot (~15s), entao checar so a porta nao causa relancamento em duplicidade.
#
# Relanca lancando o start-carrier.cmd DIRETO (Start-Process), NUNCA via
# schtasks /run -- chamar schtasks /run de dentro do contexto da task watchdog e
# recusado pelo Windows (0x800710E0). O carrier e headless (node server), nao
# precisa de sessao interativa.
$ErrorActionPreference = "SilentlyContinue"
$root = "C:\aya-expo-tools-player1"
$log  = Join-Path $root "logs\carrier-watchdog.log"
function CarrierServing { (Get-NetTCPConnection -State Listen -LocalPort 3100 -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0 }
if (CarrierServing) { exit 0 }
Start-Sleep -Seconds 8
if (CarrierServing) { exit 0 }
# Nao esta servindo: limpa qualquer node carrier orfao (sem listener) e relanca limpo.
$ts  = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*player1-farol*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$cmd = Join-Path $root "start-carrier.cmd"
Add-Content -Path $log -Value "$ts WATCHDOG: carrier (porta 3100) fora do ar por >8s; limpou node orfao e relancou start-carrier.cmd"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$cmd`"" -WorkingDirectory $root -WindowStyle Hidden
