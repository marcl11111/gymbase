@echo off
chcp 65001 >nul
title GymBase - auf GitHub hochladen
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\github-hochladen.ps1"
echo.
pause
