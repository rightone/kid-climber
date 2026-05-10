# 构建和发布指南

## 📦 构建 Windows 安装包

### 前置条件

1. **Node.js 18+**: https://nodejs.org/
2. **Go 1.21+**: https://go.dev/dl/
3. **Rust**: https://rustup.rs/

### 构建步骤

**方法一：使用构建脚本**

```bash
# 双击运行 build-windows.bat
# 或在命令行执行
build-windows.bat
```

**方法二：手动构建**

```bash
# 1. 设置 Go 代理
go env -w GOPROXY=https://goproxy.cn,direct

# 2. 构建 Go 后端
cd backend
go mod tidy
go build -o kid-climber-server.exe ./cmd/server/main.go
cd ..

# 3. 安装前端依赖
cd frontend
npm install

# 4. 构建 Tauri 应用
npm run tauri build
cd ..
```

### 输出文件

构建完成后，安装包位于：

```
frontend/src-tauri/target/release/bundle/
├── msi/
│   └── Kid Climber_1.0.0_x64.msi          # MSI 安装包
├── nsis/
│   └── Kid Climber_1.0.0_x64-setup.exe    # EXE 安装包
└── ...
```

## 🌐 构建 Web 版本

```bash
# 双击运行 build-web.bat
# 或在命令行执行
build-web.bat
```

输出目录：`frontend/dist`

## 🚀 发布新版本

### 方法一：使用发布脚本

```bash
# 双击运行 release.bat
# 输入版本号（例如：v1.0.0）
# 确认发布
```

### 方法二：手动发布

```bash
# 1. 创建标签
git tag -a v1.0.0 -m "Release v1.0.0"

# 2. 推送标签
git push origin v1.0.0
```

### GitHub Actions 自动构建

推送标签后，GitHub Actions 会自动：

1. 构建 Windows 安装包（.msi 和 .exe）
2. 构建 macOS 安装包（.dmg）
3. 构建 Linux 安装包（.deb 和 .AppImage）
4. 创建 GitHub Release
5. 上传所有安装包

## 📋 GitHub Secrets 配置

为了使用 GitHub Actions，需要配置以下 Secrets：

### TAURI_SIGNING_PRIVATE_KEY

```bash
# 生成签名密钥
npm run tauri signer generate

# 将生成的私钥添加到 GitHub Secrets
# TAURI_SIGNING_PRIVATE_KEY=<your-private-key>
# TAURI_SIGNING_PRIVATE_KEY_PASSWORD=<your-password>
```

### 配置步骤

1. 进入 GitHub 仓库设置
2. 选择 "Secrets and variables" -> "Actions"
3. 点击 "New repository secret"
4. 添加以下 Secrets：
   - `TAURI_SIGNING_PRIVATE_KEY`: Tauri 签名私钥
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: 签名密码

## 🔧 配置文件说明

### tauri.conf.json

```json
{
  "package": {
    "productName": "Kid Climber",    // 应用名称
    "version": "1.0.0"               // 版本号
  },
  "tauri": {
    "bundle": {
      "identifier": "com.kid-climber.app",  // 应用标识
      "icon": ["icons/..."],                 // 应用图标
      "windows": {
        "nsis": {},                          // NSIS 配置
        "wix": {}                            // WiX 配置
      }
    }
  }
}
```

### GitHub Actions 工作流

```yaml
# .github/workflows/build.yml
name: Build and Release

on:
  push:
    tags:
      - 'v*'  # 推送标签时触发

jobs:
  build:
    strategy:
      matrix:
        include:
          - platform: windows-latest    # Windows
          - platform: macos-latest      # macOS
          - platform: ubuntu-22.04      # Linux
```

## 📁 输出文件说明

### Windows

- **MSI 安装包**: 标准 Windows 安装程序
- **EXE 安装包**: NSIS 安装程序，支持自定义安装

### macOS

- **DMG 文件**: macOS 磁盘映像
- **APP 文件**: macOS 应用程序

### Linux

- **DEB 文件**: Debian/Ubuntu 安装包
- **AppImage**: 通用 Linux 可执行文件

## 🐛 常见问题

### Q: 构建失败怎么办？

A: 检查以下几点：
1. Node.js、Go、Rust 是否正确安装
2. 网络连接是否正常
3. 查看错误日志定位问题

### Q: 如何修改应用图标？

A: 将图标文件放在 `frontend/src-tauri/icons/` 目录下：
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

### Q: 如何修改应用名称？

A: 编辑 `frontend/src-tauri/tauri.conf.json`：
```json
{
  "package": {
    "productName": "你的应用名称"
  }
}
```

### Q: GitHub Actions 构建失败？

A: 检查以下几点：
1. Secrets 是否正确配置
2. 标签格式是否正确（vX.Y.Z）
3. 查看 GitHub Actions 日志

## 📚 相关文档

- [Tauri 官方文档](https://tauri.app/v1/guides/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [NSIS 文档](https://nsis.sourceforge.io/Main_Page)

## 💡 提示

1. 首次构建可能需要较长时间（下载依赖）
2. Windows 构建需要在 Windows 环境下进行
3. macOS 构建需要在 macOS 环境下进行
4. Linux 构建可以在 Ubuntu 环境下进行
5. GitHub Actions 支持跨平台构建

---

如有问题，请提交 [Issue](https://github.com/YOUR_USERNAME/kid-climber/issues)
