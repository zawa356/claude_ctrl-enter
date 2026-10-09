@echo off
rem Execution policy is bypassed for this one process only; nothing is changed globally.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\claude-keys.ps1" -Action install
echo.
pause
