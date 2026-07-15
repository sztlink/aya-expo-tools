@echo off
setlocal ENABLEDELAYEDEXPANSION

set "ROOT=%~dp0.."
cd /d "%ROOT%"

if not exist "logs" mkdir "logs"
if not exist "logs\reports" mkdir "logs\reports"

set "NODE_EXE=%ROOT%\node\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=%ROOT%\node-portable\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

set "CONFIG_NAME=%~1"
if not defined CONFIG_NAME (
  for %%f in ("%ROOT%\config\*.json") do (
    if /I not "%%~nf"=="template" if /I not "%%~nf"=="tuya-cloud" if not defined CONFIG_NAME set "CONFIG_NAME=%%~nf"
  )
)
if not defined CONFIG_NAME set "CONFIG_NAME=template-amano-rio"

echo [%date% %time%] start config=%CONFIG_NAME% >> "logs\launcher.log"
"%NODE_EXE%" --report-uncaught-exception --report-on-fatalerror --report-directory="%ROOT%\logs\reports" "%ROOT%\index.js" --config=%CONFIG_NAME% 1>>"%ROOT%\logs\stdout.log" 2>>"%ROOT%\logs\stderr.log"
set "EXIT_CODE=%ERRORLEVEL%"
echo [%date% %time%] exit code=%EXIT_CODE% >> "logs\launcher.log"
exit /b %EXIT_CODE%
