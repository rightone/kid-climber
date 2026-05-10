@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Kid Climber - Windows 构建脚本
echo ========================================
echo.

:: 检查环境
echo [1/5] 检查环境...

:: 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 未安装 Node.js
    echo 请安装 Node.js 18+: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查 Go
where go >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 未安装 Go
    echo 请安装 Go 1.21+: https://go.dev/dl/
    pause
    exit /b 1
)

:: 检查 Rust
where rustc >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 未安装 Rust
    echo 请安装 Rust: https://rustup.rs/
    pause
    exit /b 1
)

:: 检查 cargo
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 未安装 Cargo
    echo 请安装 Rust: https://rustup.rs/
    pause
    exit /b 1
)

echo 环境检查通过!
echo.

:: 设置 Go 代理
echo [2/5] 配置 Go 代理...
go env -w GOPROXY=https://goproxy.cn,direct
echo Go 代理配置完成!
echo.

:: 构建后端
echo [3/5] 构建 Go 后端...
cd backend
go mod tidy
if %errorlevel% neq 0 (
    echo 错误: Go mod tidy 失败
    pause
    exit /b 1
)

go build -o kid-climber-server.exe ./cmd/server/main.go
if %errorlevel% neq 0 (
    echo 错误: Go 构建失败
    pause
    exit /b 1
)
cd ..
echo Go 后端构建完成!
echo.

:: 安装前端依赖
echo [4/5] 安装前端依赖...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo 错误: npm install 失败
    pause
    exit /b 1
)
echo 前端依赖安装完成!
echo.

:: 构建 Tauri 应用
echo [5/5] 构建 Tauri 应用...
call npm run tauri build
if %errorlevel% neq 0 (
    echo 错误: Tauri 构建失败
    pause
    exit /b 1
)
cd ..

echo.
echo ========================================
echo 构建完成!
echo ========================================
echo.
echo 安装包位置:
echo   MSI: frontend\src-tauri\target\release\bundle\msi\
echo   EXE: frontend\src-tauri\target\release\bundle\nsis\
echo.
echo 按任意键打开输出目录...
pause >nul
explorer "frontend\src-tauri\target\release\bundle"
