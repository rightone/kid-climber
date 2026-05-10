@echo off
echo ========================================
echo Kid Climber - 停止应用
echo ========================================
echo.

echo 正在停止前端服务器...
taskkill /f /im node.exe >nul 2>&1

echo 正在停止后端服务器...
taskkill /f /im kid-climber-server.exe >nul 2>&1
taskkill /f /im go.exe >nul 2>&1

echo.
echo 应用已停止！
pause
