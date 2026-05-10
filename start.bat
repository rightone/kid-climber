@echo off
echo ========================================
echo Kid Climber - 攀爬架结构设计软件
echo ========================================
echo.

echo [1/4] 检查环境...
node -v >nul 2>&1
if errorlevel 1 (
    echo 错误: 未安装Node.js，请先安装Node.js 18+
    pause
    exit /b 1
)

go version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未安装Go，请先安装Go 1.21+
    pause
    exit /b 1
)

echo [2/4] 安装前端依赖...
cd frontend
call npm install
if errorlevel 1 (
    echo 错误: 安装前端依赖失败
    pause
    exit /b 1
)

echo [3/4] 安装后端依赖...
cd ..\backend
go mod tidy
if errorlevel 1 (
    echo 错误: 安装后端依赖失败
    pause
    exit /b 1
)

echo [4/4] 启动应用...
echo.
echo 前端开发服务器: http://localhost:5173
echo 后端API服务器: http://localhost:8080
echo.
echo 按Ctrl+C停止服务器
echo.

cd ..\frontend
start "Kid Climber Frontend" cmd /k "npm run dev"
cd ..\backend
start "Kid Climber Backend" cmd /k "go run cmd/server/main.go"

echo 应用已启动！
echo 请在浏览器中访问 http://localhost:5173
pause
