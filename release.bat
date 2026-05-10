@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Kid Climber - 发布脚本
echo ========================================
echo.

:: 检查 Git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 未安装 Git
    pause
    exit /b 1
)

:: 检查是否在 Git 仓库中
git rev-parse --git-dir >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 当前目录不是 Git 仓库
    pause
    exit /b 1
)

:: 获取版本号
set /p VERSION="请输入版本号 (例如: v1.0.0): "

if "%VERSION%"=="" (
    echo 错误: 版本号不能为空
    pause
    exit /b 1
)

:: 验证版本号格式
echo %VERSION% | findstr /r "^v[0-9]*\.[0-9]*\.[0-9]*$" >nul
if %errorlevel% neq 0 (
    echo 错误: 版本号格式不正确，应为 vX.Y.Z
    pause
    exit /b 1
)

echo.
echo 版本号: %VERSION%
echo.

:: 确认发布
set /p CONFIRM="确认发布 %VERSION%? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo 已取消发布
    pause
    exit /b 0
)

echo.
echo [1/3] 检查工作目录...

:: 检查是否有未提交的更改
git status --porcelain | findstr . >nul
if %errorlevel% equ 0 (
    echo 警告: 有未提交的更改
    set /p CONTINUE="是否继续? (y/n): "
    if /i not "%CONTINUE%"=="y" (
        echo 已取消发布
        pause
        exit /b 0
    )
)

echo.
echo [2/3] 创建 Git 标签...

:: 创建标签
git tag -a %VERSION% -m "Release %VERSION%"
if %errorlevel% neq 0 (
    echo 错误: 创建标签失败
    pause
    exit /b 1
)

echo 标签 %VERSION% 创建成功!
echo.
echo [3/3] 推送标签到远程仓库...

:: 推送标签
git push origin %VERSION%
if %errorlevel% neq 0 (
    echo 错误: 推送标签失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo 发布成功!
echo ========================================
echo.
echo 标签 %VERSION% 已推送到远程仓库
echo GitHub Actions 将自动构建并创建 Release
echo.
echo 请访问: https://github.com/YOUR_USERNAME/kid-climber/releases
echo.
pause
