@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SIMK ITP B - Jalankan Website
call "%~dp0scripts\prepare-and-check.bat"
if errorlevel 1 goto failed

echo.
echo ==============================================================
echo       SIMK ITP B SIAP DIBUKA DI BROWSER
echo ==============================================================
echo URL lokal: http://127.0.0.1:5173
echo Jangan tutup jendela ini selama website digunakan.
echo Tekan Ctrl+C untuk menghentikan server.
echo.
start "" /b node scripts\open-browser-when-ready.mjs
call npm.cmd run dev
if errorlevel 1 goto server_failed
echo.
echo Server SIMK ITP B telah berhenti.
pause
exit /b 0

:server_failed
echo ERROR: Server Vite gagal dijalankan.
:failed
echo Proses dihentikan. Ambil screenshot pesan di atas.
pause
exit /b 1
