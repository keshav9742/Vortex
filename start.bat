@echo off
cd /d "%~dp0"
echo Starting TRACE at http://127.0.0.1:5000/
start "TRACE server" /b python app.py
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5000/"
echo TRACE is running. Keep this window open while using the website.
pause
