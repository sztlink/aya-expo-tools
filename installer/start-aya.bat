@echo off
title AYA Expo Tools
cd /d "%~dp0"

echo.
echo   ◇ AYA Expo Tools v2
echo   Iniciando servidor...
echo.

:: Detectar se tem config
set HAS_CONFIG=0
for %%f in (config\*.json) do (
    if not "%%~nf"=="template" if not "%%~nf"=="template-amano-rio" if not "%%~nf"=="tuya-cloud" set HAS_CONFIG=1
)

:: Iniciar com ou sem config
if "%HAS_CONFIG%"=="1" (
    for %%f in (config\*.json) do (
        if not "%%~nf"=="template" if not "%%~nf"=="template-amano-rio" if not "%%~nf"=="tuya-cloud" (
            echo   Config: %%~nf
            start "" "http://localhost:3000"
            node\node.exe index.js --config=%%~nf
            goto :end
        )
    )
) else (
    echo   Nenhuma config encontrada. Abrindo wizard de setup...
    start "" "http://localhost:3000/#/setup"
    node\node.exe index.js
)

:end
pause
