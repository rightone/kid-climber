# Kid Climber - 攀爬架结构设计软件

一款专业的攀爬架结构设计软件，采用现代化的 Web 技术栈，提供直观的 3D 可视化设计体验。

## ✨ 功能特性

### 🎨 3D 可视化设计
- 实时 3D 预览，支持旋转、缩放、平移
- 拖拽式组件放置，直观易用
- 多种视图模式（真实感、线框、X光、黑白）
- 网格显示和组件吸附
- 组件连接点显示
- 高级光照和阴影效果
- 平滑动画和过渡效果

### 🧩 丰富的组件库
- **基础管件**: 10cm、15cm、30cm、60cm 直管
- **连接件**: 90度弯头、45度弯头、垂直弯头、三通、四通、Y型三通
- **平台类**: 小、中、大、长平台
- **附件**: 秋千、滑梯、绳梯、攀爬墙、猴杆
- **结构件**: 支撑架、底座、端盖

### 📊 材料管理
- 自动计算材料需求
- 库存管理和短缺统计
- 连接损耗计算
- 成本预估

### 🔍 结构分析
- 稳定性检查
- 连接分析
- 支撑检查
- 平衡分析
- 安全评估

### 📁 文件管理
- 设计文件保存/加载
- 多格式导出（PNG、OBJ、GLTF）
- 材料清单打印
- 设计文件分享

### ⌨️ 快捷键支持
- Ctrl+Z/Y：撤销/重做
- Ctrl+C/V：复制/粘贴
- Ctrl+D：复制选中组件
- V/M/R：工具切换
- 1/2/3/4：视图模式切换
- G：切换网格显示
- L：切换连接点显示

### 🎨 主题系统
- 多种主题（浅色、深色、蓝色、绿色）
- 一键切换主题
- 自定义主题配置

### 📚 帮助系统
- 新手教程
- 快捷键帮助
- 常见问题
- 视频教程

### 🔧 高级功能
- 设计模板和预设
- 组件搜索和过滤
- 结构稳定性检查
- 材料成本计算
- 施工图纸生成

### 🛡️ 错误处理
- 完善的错误处理机制
- 错误边界组件
- 性能监控
- 错误日志记录

## 🛠️ 技术栈

### 前端
- **框架**：React 18 + TypeScript
- **3D渲染**：Three.js + react-three-fiber
- **状态管理**：Zustand
- **UI组件**：Ant Design
- **构建工具**：Vite

### 后端
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

### 安装依赖

**前端**：
```bash
cd frontend
npm install
```

**后端**：
```bash
cd backend
go mod tidy
```

### 开发模式

**启动前端开发服务器**：
```bash
cd frontend
npm run dev
```

**启动后端服务器**：
```bash
cd backend
go run cmd/server/main.go
```

**启动Tauri桌面应用**：
```bash
cd frontend
npm run tauri dev
```

### 生产构建

**构建前端**：
```bash
cd frontend
npm run build
```

**编译后端**：
```bash
cd backend
go build -o kid-climber-server cmd/server/main.go
```

**打包桌面应用**：
```bash
cd frontend
npm run tauri build
```

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
└── README.md
```

## 📖 使用说明

### 1. 创建新设计
1. 启动应用后，点击"新建设计"
2. 从左侧组件库选择组件
3. 拖拽组件到3D视图中放置

### 2. 编辑组件
1. 点击组件进行选择
2. 在右侧属性面板修改位置、旋转、缩放
3. 使用工具栏进行移动、旋转、删除操作

### 3. 管理材料
1. 切换到"材料"标签页
2. 查看材料需求清单
3. 编辑已有材料数量
4. 导出或打印材料清单

### 4. 结构分析
1. 切换到"分析"标签页
2. 点击"分析"按钮
3. 查看稳定性分数和问题列表
4. 根据建议优化设计

### 5. 保存和导出
1. 点击"保存"按钮保存设计
2. 点击"导出"按钮选择导出格式
3. 支持导出为图片、3D模型、材料清单

## 🎯 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+Z | 撤销 |
| Ctrl+Y | 重做 |
| Ctrl+C | 复制 |
| Ctrl+V | 粘贴 |
| Ctrl+D | 复制选中组件 |
| Ctrl+A | 全选 |
| Delete | 删除 |
| Escape | 取消选择 |
| V | 选择工具 |
| M | 移动工具 |
| R | 旋转工具 |
| G | 切换网格 |
| L | 切换连接点 |
| 1 | 真实感模式 |
| 2 | 线框模式 |
| 3 | X光模式 |
| 4 | 黑白模式 |
| 4 | 黑白模式 |

## 🔧 配置说明

### 前端配置
- `vite.config.ts`：Vite构建配置
- `tsconfig.json`：TypeScript配置
- `src-tauri/tauri.conf.json`：Tauri配置

### 后端配置
- `config/config.go`：应用配置
- 环境变量：`GOPROXY`、`GO111MODULE`等

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

如有问题或建议，请提交Issue或联系开发团队。

## 📄 许可证

MIT License

## 🙏 致谢

感谢以下开源项目：
- [React](https://reactjs.org/)
- [Three.js](https://threejs.org/)
- [Ant Design](https://ant.design/)
- [Gin](https://gin-gonic.com/)
- [Tauri](https://tauri.app/)

---

**Kid Climber** - 让攀爬架设计更简单、更直观、更高效！
