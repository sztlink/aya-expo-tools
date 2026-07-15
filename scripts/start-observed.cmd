@echo off
setlocal ENABLEDELAYEDEXPANSION

for %%I in ("%~dp0..") do set "ROOT=%%~fI"
cd /d "%ROOT%"

if not exist "logs" mkdir "logs"
if not exist "logs\reports" mkdir "logs\reports"

set "NODE_EXE=%ROOT%\node\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=%ROOT%\node-portable\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

set "CONFIG_NAME=%~1"
REM Never autodetect arbitrary JSON: config\log.json and state files are not configs.
if not defined CONFIG_NAME set "CONFIG_NAME=template-amano-rio"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\cleanup-orphan-cv.ps1" -Root "%ROOT%"
"%NODE_EXE%" "%ROOT%\scripts\runtime-launcher.js" --config=%CONFIG_NAME%
exit /b %ERRORLEVEL%
