@echo off
setlocal
cd /d "%~dp0"
set "PYTHON_EXE="
where python >nul 2>nul
if not errorlevel 1 set "PYTHON_EXE=python"
if not defined PYTHON_EXE (
  where py >nul 2>nul
  if not errorlevel 1 set "PYTHON_EXE=py -3"
)
if not defined PYTHON_EXE (
  echo ERRO: Python nao encontrado. Instale Python 3.10+ e ative Add Python to PATH.
  pause
  exit /b 1
)
echo ========================================
echo       CARTOON TIMELINE  v1.04
echo ========================================
echo Site local: http://localhost:3000
echo Rede local: http://SEU-IP-LOCAL:3000
echo Pressione Ctrl+C para encerrar.
echo.
start "" http://localhost:3000
%PYTHON_EXE% server.py --host 0.0.0.0 --port 3000
pause
