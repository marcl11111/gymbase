@echo off
chcp 65001 >nul
title GymBase - lokale Vorschau
cd /d "C:\Users\marce\Desktop\gymbase"

where node >nul 2>nul
if errorlevel 1 (
  echo [FEHLER] Node.js wurde nicht gefunden. Bitte von https://nodejs.org installieren.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/3] Abhaengigkeiten werden installiert ...
  call npm install
  if errorlevel 1 goto :fehler
)

if /i "%~1"=="build" goto :build
if not exist "dist\index.html" goto :build
goto :start

:build
echo [2/3] Produktions-Build wird erstellt ...
call npm run build
if errorlevel 1 goto :fehler

:start
echo [3/3] GymBase startet unter http://localhost:4173
echo        Zum Beenden dieses Fenster schliessen oder Strg+C druecken.
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:4173"
call npm run preview -- --port 4173 --strictPort
goto :eof

:fehler
echo.
echo [FEHLER] Der letzte Schritt ist fehlgeschlagen. Ausgabe oben pruefen.
pause
exit /b 1
