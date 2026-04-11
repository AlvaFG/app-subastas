@echo off
REM Script para ejecutar las migraciones SQL manualmente
REM Asegúrate de que SQL Server esté corriendo en localhost:1433

echo.
echo ======================================
echo Ejecutando migraciones SQL...
echo ======================================
echo.

cd /d "%~dp0server"

echo Migracion 1: Corregir typos...
node run-migrations.js

if errorlevel 1 (
  echo.
  echo ERROR: Las migraciones fallaron.
  echo Verifica que SQL Server esté corriendo en localhost:1433
  pause
  exit /b 1
)

echo.
echo ======================================
echo Migraciones completadas exitosamente!
echo ======================================
pause
