# Kid Climber

Kid Climber 是一款开源的攀爬架快速搭建与设计工具。它通过“搭积木”式交互，帮助用户快速组合各类攀爬架结构，并提供离线 3D 设计、材料清单和装配输出。

[![CI](https://github.com/rightone/kid-climber/actions/workflows/ci.yml/badge.svg)](https://github.com/rightone/kid-climber/actions/workflows/ci.yml)
[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL--3.0--only-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

## 项目状态

当前版本处于 Alpha 阶段，功能、设计文件格式和交互仍可能调整。

## 主要能力

- 任务式搭建基础平台架、延长结构、斜撑、A 字架、平台、U 形攀爬拱和坡道。
- 一次展示有效安装位，并以完整结构预览后按单个事务提交。
- 将 A 字架作为逻辑结构组选择、复制、重新安装和删除。
- 离线 3D 编辑、端点增长、拓扑检查、撤销与重做。
- 材料清单、装配教程、PDF、PNG、OBJ 和设计文件导出。
- Windows、macOS 和 Linux 桌面构建。

## 工具链

- Node.js 24
- Go 1.26.3
- Rust 1.94.1
- React 19、TypeScript 6、Three.js、Ant Design 6
- Tauri 1.6、Go + Gin + GORM

工具链版本由 `.node-version`、`backend/go.mod` 和 `rust-toolchain.toml` 固定。

## 本地开发

```bash
git clone https://github.com/rightone/kid-climber.git
cd kid-climber

cd frontend
npm ci
npm run dev
```

开发服务器默认位于 <http://localhost:5173>。

后端可在另一个终端启动：

```bash
cd backend
go mod download
go run ./cmd/server
```

## 验证与构建

```bash
cd frontend
npm test
npm run build
npm run lint:baseline
npm run check:release

cd ../backend
go test ./...
go build ./cmd/server

cd ../frontend/src-tauri
cargo check --locked
```

CI 会验证前端测试、构建和 ESLint 门禁、后端测试与构建，以及桌面端 Rust 检查。

## 发布说明

普通 `main` 提交和 Pull Request 运行 CI。版本标签触发的桌面构建只创建 GitHub draft prerelease，不会在工作流中修改源码版本。下载入口见 [GitHub Releases](https://github.com/rightone/kid-climber/releases)。

## 贡献

贡献方式和本地检查见 [CONTRIBUTING.md](CONTRIBUTING.md)。第三方依赖与字体许可见 [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md)。

## 许可证与品牌声明

本版本采用 [GNU Affero General Public License v3.0 only](LICENSE)。网络提供修改版也必须按照 AGPL 向用户提供对应源码。

根据 AGPL 第 7(b)/(c) 条，交互界面必须保留以下声明和原项目链接，修改版不得歪曲来源并应标明修改：

> Kid Climber — an open-source climbing-frame design project by Kid Climber contributors.

<https://github.com/rightone/kid-climber>

完整附加声明见 [NOTICE](NOTICE)。
