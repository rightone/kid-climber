# Kid Climber - 攀爬架结构设计软件

一款基于Web技术的3D攀爬架结构设计软件，支持可视化设计、材料预估和清单导出。

## 🎯 项目简介

Kid Climber是一款专为攀爬架设计而开发的软件，旨在为用户提供直观、高效的3D设计体验。无论是家庭游乐设施还是专业攀爬架，都可以通过本软件进行可视化设计和材料规划。

## ✨ 核心功能

### 🎨 3D可视化设计
- **实时3D预览**：支持360度旋转、缩放、平移
- **拖拽式操作**：从组件库拖拽组件到3D视图
- **多种视图模式**：真实感、线框、X光、黑白模式
- **网格和对齐**：自动网格吸附和组件对齐

### 🧩 丰富组件库
- **基础管件**：30cm/15cm直管
- **连接件**：90度/45度弯头、三通、四通接头
- **平台类**：小/中/大平台
- **附件**：秋千、滑梯、绳梯

### 📊 材料管理
- **自动计算**：自动统计所需材料数量
- **库存管理**：记录已有材料，计算短缺
- **损耗计算**：考虑连接损耗和备用材料
- **成本预估**：估算材料总成本

### 📁 文件管理
- **保存/加载**：设计文件本地保存
- **多格式导出**：支持PNG、OBJ、GLTF格式
- **清单打印**：生成可打印的材料清单
- **设计分享**：导出设计文件分享给他人

### ⌨️ 快捷键支持
- **编辑操作**：Ctrl+Z/Y撤销/重做，Ctrl+C/V复制粘贴
- **工具切换**：V选择、M移动、R旋转、T测量
- **视图控制**：G切换网格，L切换连接点
- **模式切换**：1/2/3/4切换视图模式

## 🛠️ 技术架构

### 前端技术栈
- **框架**：React 18 + TypeScript
- **3D渲染**：Three.js + react-three-fiber
- **状态管理**：Zustand
- **UI组件**：Ant Design
- **构建工具**：Vite

### 后端技术栈
- **语言**：Go 1.21+
- **Web框架**：Gin
- **ORM**：GORM
- **数据库**：SQLite

### 桌面打包
- **框架**：Tauri 2.0
- **支持平台**：Windows、macOS、Linux

## 🚀 快速开始

### 环境要求
- Node.js 18+
- Go 1.21+
- Rust（用于Tauri打包）

### 安装和运行

**1. 克隆项目**
```bash
git clone https://github.com/your-username/kid-climber.git
cd kid-climber
```

**2. 安装依赖**
```bash
# 前端依赖
cd frontend
npm install

# 后端依赖
cd ../backend
go mod tidy
```

**3. 启动开发服务器**
```bash
# 启动前端（新终端）
cd frontend
npm run dev

# 启动后端（新终端）
cd backend
go run cmd/server/main.go
```

**4. 访问应用**
- 前端：http://localhost:5173
- 后端API：http://localhost:8080

### 生产构建

**构建前端**
```bash
cd frontend
npm run build
```

**编译后端**
```bash
cd backend
go build -o kid-climber-server cmd/server/main.go
```

**打包桌面应用**
```bash
cd frontend
npm run tauri build
```

## 📖 使用指南

### 1. 创建新设计
1. 启动应用后，点击"新建设计"
2. 从左侧组件库选择组件
3. 拖拽组件到3D视图中放置
4. 使用鼠标调整视角和组件位置

### 2. 编辑组件
1. 点击组件进行选择
2. 在右侧属性面板修改属性
3. 使用工具栏进行移动、旋转、删除
4. 支持多选和批量操作

### 3. 管理材料
1. 切换到"材料"标签页
2. 查看材料需求清单
3. 编辑已有材料数量
4. 导出或打印材料清单

### 4. 保存和导出
1. 点击"保存"按钮保存设计
2. 点击"导出"按钮选择格式
3. 支持导出为图片、3D模型、清单

## 📁 项目结构

```
kid-climber/
├── frontend/              # 前端项目
│   ├── src/
│   │   ├── components/    # React组件
│   │   ├── stores/        # 状态管理
│   │   ├── utils/         # 工具函数
│   │   └── types/         # 类型定义
│   ├── src-tauri/         # Tauri桌面应用
│   └── package.json
├── backend/               # 后端项目
│   ├── cmd/               # 命令行工具
│   ├── internal/          # 内部包
│   └── config/            # 配置文件
├── doc/                   # 项目文档
├── README.md              # 项目说明
├── LICENSE                # 许可证
└── .gitignore             # Git忽略文件
```

## 🎯 快捷键参考

| 快捷键 | 功能 |
|--------|------|
| Ctrl+Z | 撤销 |
| Ctrl+Y | 重做 |
| Ctrl+C | 复制 |
| Ctrl+V | 粘贴 |
| Delete | 删除 |
| V | 选择工具 |
| M | 移动工具 |
| R | 旋转工具 |
| T | 测量工具 |
| G | 切换网格 |
| L | 切换连接点 |
| 1 | 真实感模式 |
| 2 | 线框模式 |
| 3 | X光模式 |
| 4 | 黑白模式 |

## 🔧 配置说明

### 前端配置
- `vite.config.ts`：Vite构建配置
- `tsconfig.json`：TypeScript配置
- `src-tauri/tauri.conf.json`：Tauri配置

### 后端配置
- `config/config.go`：应用配置
- 环境变量：`GOPROXY=https://goproxy.cn,direct`

## 📦 依赖说明

### 前端主要依赖
```json
{
  "react": "^18.0.0",
  "three": "^0.150.0",
  "@react-three/fiber": "^8.0.0",
  "zustand": "^4.0.0",
  "antd": "^5.0.0",
  "file-saver": "^2.0.0"
}
```

### 后端主要依赖
```go
require (
    github.com/gin-gonic/gin v1.12.0
    gorm.io/gorm v1.31.1
    gorm.io/driver/sqlite v1.6.0
)
```

## 🐛 问题反馈

如有问题或建议，请通过以下方式反馈：
- 提交GitHub Issue
- 发送邮件至开发团队
- 参与社区讨论

## 📄 许可证

本项目采用MIT许可证，详见[LICENSE](LICENSE)文件。

## 🙏 致谢

感谢以下开源项目：
- [React](https://reactjs.org/)
- [Three.js](https://threejs.org/)
- [Ant Design](https://ant.design/)
- [Gin](https://gin-gonic.com/)
- [Tauri](https://tauri.app/)

---

**Kid Climber** - 让攀爬架设计更简单、更直观、更高效！
