@echo off
REM Cria/atualiza a task "AYA Expo Tools Carrier Watchdog" (roda a cada 1 min) que
REM vigia o carrier do expo-tools e relanca via start-carrier.cmd se ele cair.
REM Deploy: copiar carrier-watchdog.ps1 para C:\aya-expo-tools-player1\ e rodar isto.
set "WD=C:\aya-expo-tools-player1\carrier-watchdog.ps1"
schtasks /create /tn "AYA Expo Tools Carrier Watchdog" /tr "powershell -NoProfile -ExecutionPolicy Bypass -File \"%WD%\"" /sc minute /mo 1 /ru "%USERNAME%" /it /f
echo.
echo Task "AYA Expo Tools Carrier Watchdog" instalada apontando para:
echo   %WD%
