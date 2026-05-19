@echo off
title Iniciar Laboratorio Virtual de Fisica
echo =======================================================
echo     Iniciando Servidor Flask y Tunel de Cloudflare
echo =======================================================
echo.

:: 1. Iniciar Flask en una nueva ventana
echo [+] Iniciando Flask en el puerto 5001...
cd /d "%~dp0app"
start "Servidor Flask" cmd /c "py -3 app.py"

:: 2. Esperar 3 segundos para asegurar que Flask arranco
timeout /t 3 /nobreak >nul

:: 3. Iniciar el tunel de Cloudflare en una nueva ventana
echo [+] Iniciando tunel de Cloudflare...
start "Tunel Cloudflare" cmd /k ""C:\Users\adecu\AppData\Local\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe" tunnel --url http://localhost:5001"

echo.
echo =======================================================
echo [LISTO] Revisa la ventana de Cloudflare para copiar tu URL publica.
echo =======================================================
pause
