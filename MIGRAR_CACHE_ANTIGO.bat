@echo off
chcp 65001 >nul
cd /d "%~dp0"
if "%~1"=="" (
 echo Arraste a pasta onde esta a versao antiga sobre este arquivo BAT.
 echo Exemplo: arraste a pasta Cartoon_Timeline_v0.8.8 para ca.
 pause
 exit /b 1
)
where python >nul 2>&1
if errorlevel 1 (
 echo Python nao foi encontrado. Instale Python e habilite o PATH.
 pause
 exit /b 1
)
python "%~dp0MIGRAR_CACHE_ANTIGO.py" "%~1"
pause
