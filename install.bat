@echo off
setlocal enabledelayedexpansion
title AYA Expo Tools — Instalador Offline
color 0F

echo.
echo   ^<^> AYA EXPO TOOLS
echo   Instalador Offline v2.0
echo   aya.studio
echo.
echo ============================================================
echo.
echo   INSTALACAO OFFLINE A PARTIR DO PENDRIVE
echo   Tempo estimado: 45-90 minutos (dependendo do HD/SSD)
echo.
echo ============================================================
echo.

:: ─── Admin check ─────────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
  echo   [!] PERMISSAO INSUFICIENTE
  echo.
  echo       Este instalador precisa de permissoes de Administrador.
  echo       Clique direito no arquivo ^> Executar como administrador
  echo.
  pause
  exit /b 1
)

:: ─── Detect pendrive path ────────────────────────────────────
set PENDRIVE=%~dp0
echo   [INFO] Pendrive detectado em: %PENDRIVE%
echo.

:: ─── Configuration ───────────────────────────────────────────
set INSTALL_DIR=C:\aya-expo-tools
set NODE_SRC=%PENDRIVE%node-portable
set VENV_SRC=%PENDRIVE%python-venv
set MODELS_SRC=%PENDRIVE%models
set WG_CONFIG_SRC=%PENDRIVE%wg-config
set CODE_SRC=%PENDRIVE%aya-expo-tools

:: ─── Step 1: Copy code ───────────────────────────────────────
echo.
echo   [1/8] Copiando codigo do aya-expo-tools...
echo         Origem: %CODE_SRC%
echo         Destino: %INSTALL_DIR%
echo.

if not exist "%CODE_SRC%" (
  echo   [!] ERRO: Pasta aya-expo-tools/ nao encontrada no pendrive.
  echo       Verifique o layout do pendrive. Consulte docs/PENDRIVE-LAYOUT.md
  pause
  exit /b 1
)

if not exist "%INSTALL_DIR%" (
  mkdir "%INSTALL_DIR%"
)

echo         Copiando arquivos...
xcopy /S /E /Y /Q "%CODE_SRC%\*" "%INSTALL_DIR%\" >nul
if %errorLevel% neq 0 (
  echo   [!] ERRO ao copiar codigo.
  pause
  exit /b 1
)

echo         Codigo copiado com sucesso. (~500MB)
echo.

:: ─── Step 2: Copy Node.js portable ───────────────────────────
echo   [2/8] Copiando Node.js portable...
echo         Origem: %NODE_SRC%
echo         Destino: %INSTALL_DIR%\node-portable
echo.

if not exist "%NODE_SRC%\node.exe" (
  echo   [!] ERRO: Node.js portable nao encontrado no pendrive.
  echo       Faltando: %NODE_SRC%\node.exe
  pause
  exit /b 1
)

if not exist "%INSTALL_DIR%\node-portable" (
  mkdir "%INSTALL_DIR%\node-portable"
)

echo         Copiando arquivos...
xcopy /S /E /Y /Q "%NODE_SRC%\*" "%INSTALL_DIR%\node-portable\" >nul
if %errorLevel% neq 0 (
  echo   [!] ERRO ao copiar Node.js.
  pause
  exit /b 1
)

echo         Node.js portable instalado. (~100MB)
echo.

:: ─── Step 3: Copy Python venv ────────────────────────────────
echo   [3/8] Copiando Python venv com PyTorch + YOLO...
echo         Origem: %VENV_SRC%
echo         Destino: %INSTALL_DIR%\clusters\cv\python\venv
echo.
echo         [!] ATENCAO: Este passo vai demorar 20-60 minutos.
echo             O venv tem ~7GB com torch + ultralytics + onnxruntime.
echo             Seja paciente. Nao feche esta janela.
echo.

if not exist "%VENV_SRC%\Scripts\python.exe" (
  echo   [!] ERRO: Python venv nao encontrado no pendrive.
  echo       Faltando: %VENV_SRC%\Scripts\python.exe
  pause
  exit /b 1
)

if not exist "%INSTALL_DIR%\clusters\cv\python" (
  mkdir "%INSTALL_DIR%\clusters\cv\python"
)

echo         Iniciando copia... (7GB, pode demorar)
set START_TIME=%time%
xcopy /S /E /Y /Q "%VENV_SRC%\*" "%INSTALL_DIR%\clusters\cv\python\venv\" >nul
if %errorLevel% neq 0 (
  echo   [!] ERRO ao copiar Python venv.
  pause
  exit /b 1
)

set END_TIME=%time%
echo         Python venv copiado com sucesso. (~7GB)
echo         Tempo decorrido: %START_TIME% - %END_TIME%
echo.

:: ─── Step 4: Copy models ─────────────────────────────────────
echo   [4/8] Copiando modelos de Computer Vision...
echo         Origem: %MODELS_SRC%
echo         Destino: %INSTALL_DIR%\clusters\cv\python\models
echo.

if not exist "%MODELS_SRC%\yolov8l.pt" (
  echo   [!] AVISO: yolov8l.pt nao encontrado no pendrive.
  echo       Modelo YOLO pode nao funcionar.
) else (
  if not exist "%INSTALL_DIR%\clusters\cv\python\models" (
    mkdir "%INSTALL_DIR%\clusters\cv\python\models"
  )
  
  echo         Copiando yolov8l.pt...
  copy /Y "%MODELS_SRC%\yolov8l.pt" "%INSTALL_DIR%\clusters\cv\python\models\yolov8l.pt" >nul
  echo         yolov8l.pt copiado. (~175MB)
)

if not exist "%MODELS_SRC%\osnet_x0_25.onnx" (
  echo   [!] AVISO: osnet_x0_25.onnx nao encontrado no pendrive.
  echo       Modelo de ReID pode nao funcionar.
) else (
  echo         Copiando osnet_x0_25.onnx...
  copy /Y "%MODELS_SRC%\osnet_x0_25.onnx" "%INSTALL_DIR%\clusters\cv\python\models\osnet_x0_25.onnx" >nul
  echo         osnet_x0_25.onnx copiado. (~1MB)
)

echo         Modelos copiados com sucesso.
echo.

:: ─── Step 5: WireGuard ───────────────────────────────────────
echo   [5/8] Verificando WireGuard VPN...
echo.

where wg >nul 2>&1
if %errorLevel% equ 0 (
  echo         WireGuard ja instalado. OK.
  
  if exist "%WG_CONFIG_SRC%" (
    echo         Importando configuracoes do pendrive...
    for %%f in ("%WG_CONFIG_SRC%\*.conf") do (
      echo         - Importando %%~nxf
      copy /Y "%%f" "C:\Program Files\WireGuard\Data\Configurations\" >nul 2>&1
    )
    echo         Configuracoes importadas. Ative via GUI do WireGuard.
  ) else (
    echo         [INFO] Sem configs no pendrive. Configure manualmente depois.
  )
) else (
  echo         [!] WireGuard nao instalado.
  echo.
  if exist "%WG_CONFIG_SRC%" (
    echo         [ACAO NECESSARIA] Instale WireGuard manualmente:
    echo         1. Baixe de: https://www.wireguard.com/install/
    echo         2. Instale o WireGuard
    echo         3. Importe os arquivos .conf da pasta wg-config/ do pendrive
    echo         4. Ative o tunel manualmente
    echo.
    echo         Consulte docs/FALLBACK.md para instrucoes detalhadas.
  ) else (
    echo         [INFO] Sem WireGuard e sem configs. Pule esta etapa.
  )
)
echo.

:: ─── Step 6: Install npm dependencies ────────────────────────
echo   [6/8] Instalando dependencias Node.js...
echo         Usando Node.js portable em: %INSTALL_DIR%\node-portable
echo.

cd /d "%INSTALL_DIR%"
"%INSTALL_DIR%\node-portable\npm.cmd" install --production --no-audit --no-fund 2>nul
if %errorLevel% neq 0 (
  echo   [!] ERRO ao instalar dependencias NPM.
  echo       Verifique se o Node.js portable esta OK.
  pause
  exit /b 1
)

echo         Dependencias instaladas com sucesso.
echo.

:: ─── Step 7: Task Scheduler ──────────────────────────────────
echo   [7/8] Configurando inicializacao automatica...
echo.

set NODE_EXE=%INSTALL_DIR%\node-portable\node.exe
set INDEX_JS=%INSTALL_DIR%\index.js

:: Detectar qual config usar (amano-rio.json se existir, senao first available)
set CONFIG_FILE=amano-rio
if not exist "%INSTALL_DIR%\config\%CONFIG_FILE%.json" (
  echo         [!] AVISO: config/amano-rio.json nao encontrado.
  echo             Use o primeiro config disponivel ou crie manualmente.
  for %%f in ("%INSTALL_DIR%\config\*.json") do (
    set CONFIG_FILE=%%~nf
    goto :config_found
  )
  :config_found
)

echo         Usando config: %CONFIG_FILE%.json
echo.

schtasks /query /tn "AYA Expo Tools" >nul 2>&1
if %errorLevel% neq 0 (
  echo         Criando tarefa no Task Scheduler...
  schtasks /create /tn "AYA Expo Tools" /tr "\"%NODE_EXE%\" \"%INDEX_JS%\" --config=%CONFIG_FILE%" /sc onstart /ru SYSTEM /rl HIGHEST /f >nul
  echo         Task Scheduler configurado. Inicia automaticamente no boot.
) else (
  echo         Atualizando tarefa existente...
  schtasks /change /tn "AYA Expo Tools" /tr "\"%NODE_EXE%\" \"%INDEX_JS%\" --config=%CONFIG_FILE%" >nul
  echo         Task Scheduler atualizado.
)
echo.

:: ─── Step 8: Start server ────────────────────────────────────
echo   [8/8] Iniciando servidor...
echo.

echo         Abrindo navegador em http://localhost:3000
echo         Aguarde alguns segundos para o servidor iniciar...
echo.

start "" http://localhost:3000

cd /d "%INSTALL_DIR%"
start "AYA Expo Tools Server" "%NODE_EXE%" "%INDEX_JS%" --config=%CONFIG_FILE%

timeout /t 5 /nobreak >nul

:: ─── Completion ──────────────────────────────────────────────
echo.
echo ============================================================
echo.
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo.
echo   - Servidor rodando em: http://localhost:3000
echo   - Logs em: %INSTALL_DIR%\logs\
echo   - Config: %INSTALL_DIR%\config\%CONFIG_FILE%.json
echo.
echo   Proximos passos:
echo   1. Configure o expo no Portal AYA (se disponivel)
echo   2. Teste as cameras e projetores
echo   3. Ative o WireGuard (se necessario)
echo   4. Consulte README.md para instrucoes de uso
echo.
echo   Em caso de problemas, consulte: docs/FALLBACK.md
echo.
echo ============================================================
echo.
pause
