@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\server-control.ps1" -Action stop %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Falha ao encerrar o servidor. Codigo: %EXIT_CODE%
)

exit /b %EXIT_CODE%
