# GitHub 同步指南

## 🚀 快速开始

### 1. 登录 GitHub

打开新的终端/PowerShell，运行：

```bash
gh auth login
```

按提示选择：
- GitHub.com
- HTTPS
- 浏览器登录

### 2. 创建仓库并推送

登录成功后，在项目目录运行：

```bash
# 创建 GitHub 仓库
gh repo create kid-climber --public --source=. --push

# 或者私有仓库
gh repo create kid-climber --private --source=. --push
```

### 3. 发布版本

```bash
# 创建版本标签
git tag -a v1.0.0 -m "Release v1.0.0"

# 推送标签触发自动构建
git push origin v1.0.0
```

## 📦 GitHub Actions 自动构建

推送标签后，GitHub Actions 会自动：

1. ✅ 构建 Windows 安装包（.msi 和 .exe）
2. ✅ 构建 macOS 安装包（.dmg）
3. ✅ 构建 Linux 安装包（.deb 和 .AppImage）
4. ✅ 创建 GitHub Release
5. ✅ 上传所有安装包

## 🔧 配置 Secrets（可选）

如果需要自动签名，配置以下 Secrets：

1. 进入仓库设置：`https://github.com/YOUR_USERNAME/kid-climber/settings/secrets/actions`
2. 添加以下 Secrets：

```
TAURI_SIGNING_PRIVATE_KEY=<your-private-key>
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=<your-password>
```

生成签名密钥：
```bash
npm run tauri signer generate
```

## 📋 项目状态

- ✅ Git 仓库已初始化
- ✅ 初始提交已完成（102 个文件）
- ✅ GitHub Actions 工作流已配置
- ✅ 构建脚本已准备
- ⏳ 等待推送到 GitHub

## 🎯 下一步

1. 运行 `gh auth login` 登录 GitHub
2. 运行 `gh repo create kid-climber --public --source=. --push` 创建仓库
3. 访问 https://github.com/YOUR_USERNAME/kid-climber 查看仓库
4. 创建版本标签触发自动构建

## 📚 相关文档

- `BUILD.md` - 构建和发布指南
- `README.md` - 项目说明
- `.github/workflows/build.yml` - CI/CD 配置

---

**注意**：请将 `YOUR_USERNAME` 替换为你的 GitHub 用户名
