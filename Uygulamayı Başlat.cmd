@echo off
rem Akil Oyunlari Kocu: cift tiklayinca uygulamayi baslatir.
chcp 65001 >nul
title Akil Oyunlari Kocu
cd /d "%~dp0"
set "NODE=node"
where node >nul 2>nul && goto run
if exist "%USERPROFILE%\.claude-tools\node\node.exe" (set "NODE=%USERPROFILE%\.claude-tools\node\node.exe" & goto run)
if exist "%ProgramFiles%\nodejs\node.exe" (set "NODE=%ProgramFiles%\nodejs\node.exe" & goto run)
echo.
echo   Node.js bulunamadi. https://nodejs.org adresinden LTS surumunu kur, sonra tekrar dene.
pause
exit /b 1
:run
"%NODE%" scripts\start-app.mjs %*
if errorlevel 1 pause
