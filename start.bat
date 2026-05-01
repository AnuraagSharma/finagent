@echo off
REM Double-click this file to launch FinAgent locally (Redis + backend in docker, frontend in a new window).
REM It just hands off to start.ps1 with bypassed execution policy.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
pause
