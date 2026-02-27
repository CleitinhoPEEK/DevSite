@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado no PATH.
  echo Instale o Node.js ou abra o terminal do projeto e rode:
  echo   node .\scripts\check-text-corruption.js
  echo.
  pause
  exit /b 1
)

echo Verificando textos corrompidos e encoding UTF-8...
echo.
node ".\scripts\check-text-corruption.js"
set "EXIT_CODE=%ERRORLEVEL%"
echo.

if "%EXIT_CODE%"=="0" (
  echo [OK] Verificacao concluida sem problemas.
) else (
  echo [ATENCAO] Foram encontrados problemas. Veja as linhas acima.
)

echo.
pause
exit /b %EXIT_CODE%

