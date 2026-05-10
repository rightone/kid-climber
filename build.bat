@echo off
echo ========================================
echo Kid Climber - 构建应用
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

echo [2/4] 构建前端...
cd frontend
call npm install
if errorlevel 1 (
    echo 错误: 安装前端依赖失败
    pause
    exit /b 1
)

call npm run build
if errorlevel 1 (
    echo 错误: 构建前端失败
    pause
    exit /b 1
)

echo [3/4] 构建后端...
cd ..\backend
go mod tidy
if errorlevel 1 (
    echo 错误: 安装后端依赖失败
    pause
    exit /b 1
)

go build -o kid-climber-server.exe cmd/server/main.go
if errorlevel 1 (
    echo 错误: 构建后端失败
    pause
    exit /b 1
)

echo [4/4] 构建完成！
echo.
echo 前端构建产物: frontend/dist/
echo 后端构建产物: backend/kid-climber-server.exe
echo.
echo 可以使用 start.bat 启动应用
pause
