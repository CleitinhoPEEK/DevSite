@echo off
setlocal
cd /d "%~dp0"

echo Reiniciando servidor local...
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\server-control.ps1" -Action restart %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Falha ao reiniciar o servidor. Codigo: %EXIT_CODE%
  exit /b %EXIT_CODE%
)

echo.
echo Servidor reiniciado com sucesso.
exit /b 0
