@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Kid Climber - 完整构建脚本
echo ========================================
echo.

:: 检查环境
echo [1/6] 检查环境...

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

echo 环境检查通过!
echo.

:: 设置 Go 代理
echo [2/6] 配置 Go 代理...
go env -w GOPROXY=https://goproxy.cn,direct
echo Go 代理配置完成!
echo.

:: 构建后端
echo [3/6] 构建 Go 后端...
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
echo [4/6] 安装前端依赖...
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
echo [5/6] 构建前端...
call npm run build
if %errorlevel% neq 0 (
    echo 错误: 前端构建失败
    pause
    exit /b 1
)
echo 前端构建完成!
echo.

:: 创建发布包
echo [6/6] 创建发布包...

:: 创建发布目录
if not exist "release" mkdir release
if not exist "release\kid-climber" mkdir release\kid-climber
if not exist "release\kid-climber\backend" mkdir release\kid-climber\backend
if not exist "release\kid-climber\frontend" mkdir release\kid-climber\frontend

:: 复制后端文件
copy "backend\kid-climber-server.exe" "release\kid-climber\backend\" >nul
copy "backend\kid_climber.db" "release\kid-climber\backend\" >nul 2>nul

:: 复制前端文件
xcopy "frontend\dist\*" "release\kid-climber\frontend\" /E /I /Y >nul

:: 创建启动脚本
(
echo @echo off
echo echo Starting Kid Climber...
echo echo.
echo echo Backend: http://localhost:8080
echo echo Frontend: http://localhost:5173
echo echo.
echo echo Press Ctrl+C to stop
echo echo.
echo start "Kid Climber Backend" cmd /k "backend\kid-climber-server.exe"
echo start "Kid Climber Frontend" cmd /k "npx serve frontend -p 5173"
echo echo.
echo echo Kid Climber is running!
echo echo Open http://localhost:5173 in your browser
echo pause
) > "release\kid-climber\start.bat"

:: 创建README
(
echo # Kid Climber - 攀爬架结构设计软件
echo.
echo ## 快速开始
echo.
echo 1. 双击运行 `start.bat`
echo 2. 打开浏览器访问 http://localhost:5173
echo.
echo ## 功能特性
echo.
echo - 3D 可视化设计
echo - 30+ 种预设组件
echo - 材料成本计算
echo - 结构稳定性检查
echo - 多格式导出
echo.
echo ## 技术栈
echo.
echo - 前端：React + Three.js + TypeScript
echo - 后端：Go + Gin + SQLite
echo.
echo ## 问题反馈
echo.
echo 如有问题请提交 Issue
) > "release\kid-climber\README.md"

echo 发布包创建完成!
echo.

:: 创建 ZIP 压缩包
echo 正在创建压缩包...
powershell -Command "Compress-Archive -Path 'release\kid-climber\*' -DestinationPath 'release\kid-climber-windows.zip' -Force"
if %errorlevel% equ 0 (
    echo 压缩包创建成功: release\kid-climber-windows.zip
) else (
    echo 警告: 压缩包创建失败，请手动压缩 release\kid-climber 目录
)

echo.
echo ========================================
echo 构建完成!
echo ========================================
echo.
echo 文件位置:
echo   发布目录: release\kid-climber\
echo   压缩包: release\kid-climber-windows.zip
echo.
echo 启动方式:
echo   1. 进入 release\kid-climber 目录
echo   2. 双击运行 start.bat
echo   3. 打开浏览器访问 http://localhost:5173
echo.
echo 按任意键打开发布目录...
pause >nul
explorer "release"
