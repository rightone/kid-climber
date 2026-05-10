# Kid Climber

一款专业的攀爬架结构设计软件，支持 3D 可视化设计、材料预估和清单导出。

[![Build](https://github.com/YOUR_USERNAME/kid-climber/actions/workflows/build.yml/badge.svg)](https://github.com/YOUR_USERNAME/kid-climber/actions/workflows/build.yml)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

## ✨ 功能特性

- 🎨 **3D 可视化设计** - 实时预览，支持旋转、缩放、平移
- 🧩 **30+ 预设组件** - 管件、连接件、平台、附件等
- 📊 **材料管理** - 自动计算需求、库存管理、成本预估
- 🔍 **结构分析** - 稳定性检查、连接分析、安全评估
- 📁 **多格式导出** - PNG、OBJ、GLTF、材料清单
- ⌨️ **快捷键支持** - 高效操作体验

## 🚀 快速开始

### 环境要求

- Node.js 18+
- Go 1.21+
- Rust (用于桌面应用)

### 安装

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/kid-climber.git
cd kid-climber

# 安装前端依赖
cd frontend
npm install

# 安装后端依赖
cd ../backend
go mod tidy
```

### 开发

```bash
# 启动前端开发服务器
cd frontend
npm run dev

# 启动后端服务器 (新终端)
cd backend
go run cmd/server/main.go
```

访问 http://localhost:5173

### 构建

```bash
# 构建前端
cd frontend
npm run build

# 构建后端
cd backend
go build -o kid-climber-server ./cmd/server/main.go
```

## 📦 下载

访问 [Releases](https://github.com/YOUR_USERNAME/kid-climber/releases) 页面下载安装包：

- **Windows**: `.msi` 或 `.exe` 安装包
- **macOS**: `.dmg` 文件
- **Linux**: `.deb` 或 `.AppImage`

## 🛠️ 技术栈

**前端**
- React 18 + TypeScript
- Three.js + react-three-fiber
- Zustand (状态管理)
- Ant Design (UI 组件)

**后端**
- Go + Gin
- GORM + SQLite

**桌面应用**
- Tauri 2.0

## 📖 使用说明

1. 启动应用后，从左侧组件库选择组件
2. 拖拽组件到 3D 视图中放置
3. 使用右侧属性面板调整位置和旋转
4. 切换到"材料"标签页查看清单
5. 使用"分析"功能检查结构稳定性

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📝 许可证

本项目采用 GPL-3.0 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

**这意味着：**
- ✅ 可以自由使用、修改和分发
- ✅ 可以商业使用
- ⚠️ **二次开发必须开源**
- ⚠️ **必须使用相同的 GPL-3.0 许可证**
- ⚠️ **必须保留原作者版权声明**

## 🙏 致谢

- [Three.js](https://threejs.org/)
- [React](https://reactjs.org/)
- [Tauri](https://tauri.app/)
- [Ant Design](https://ant.design/)

---

**Kid Climber** - 让攀爬架设计更简单、更直观、更高效！
