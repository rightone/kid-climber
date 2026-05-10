@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Kid Climber - Web 版本构建脚本
echo ========================================
echo.

:: 检查环境
echo [1/4] 检查环境...

:: 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 未安装 Node.js
    pause
    exit /b 1
)

:: 检查 Go
where go >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 未安装 Go
    pause
    exit /b 1
)

echo 环境检查通过!
echo.

:: 设置 Go 代理
echo [2/4] 配置 Go 代理...
go env -w GOPROXY=https://goproxy.cn,direct
echo.

:: 安装前端依赖
echo [3/4] 安装前端依赖...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo 错误: npm install 失败
    pause
    exit /b 1
)
echo 前端依赖安装完成!
echo.

:: 构建前端
echo [4/4] 构建前端...
call npm run build
if %errorlevel% neq 0 (
    echo 错误: 前端构建失败
    pause
    exit /b 1
)
cd ..

echo.
echo ========================================
echo 构建完成!
echo ========================================
echo.
echo 输出目录: frontend\dist
echo.
echo 按任意键打开输出目录...
pause >nul
explorer "frontend\dist"
