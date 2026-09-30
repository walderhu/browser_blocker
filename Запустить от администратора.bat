@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$script = Join-Path (Get-Location) 'детский_интернет.py'; if (Get-Command py.exe -ErrorAction SilentlyContinue) { Start-Process py.exe -ArgumentList @('-3', ('`"' + $script + '`"')) -Verb RunAs } else { Start-Process python.exe -ArgumentList ('`"' + $script + '`"') -Verb RunAs }"
