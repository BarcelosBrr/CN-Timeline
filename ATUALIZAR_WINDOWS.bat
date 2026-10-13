@echo off
cd /d "%~dp0"
if "%~1"=="" (
  echo Arraste a pasta da instalacao CN-Timeline para este arquivo BAT.
  echo Ou use: python atualizar.py "D:\caminho\CN-Timeline"
  pause
  exit /b 1
)
where python >nul 2>nul
if not errorlevel 1 ( python atualizar.py "%~1" ) else ( py -3 atualizar.py "%~1" )
pause
