# 贡献指南

感谢你参与 Kid Climber。公开仓库只接受能够通过测试、构建和许可证检查的源代码贡献。

## 开始贡献

1. 在 [Issue Tracker](https://github.com/rightone/kid-climber/issues) 中确认问题或说明提案。
2. Fork 仓库并从 `main` 创建功能分支。
3. 保持改动聚焦，补充与行为变化对应的测试。
4. 运行下方检查后提交 Pull Request。

## 开发环境

项目固定使用 Node.js 24、Go 1.26.3 和 Rust 1.94.1。前端依赖使用锁文件安装：

```bash
cd frontend
npm ci
npm run dev
```

## 提交前检查

```bash
cd frontend
npm test
npm run build
npm run lint:baseline

cd ../backend
go test ./...
go build ./cmd/server

cd ../frontend/src-tauri
cargo check --locked
```

ESLint 使用历史基线门禁：允许减少现有问题，不允许增加错误或警告。修改代码时请尽量顺手修复所涉及文件中的存量问题。

## 代码与提交约定

- TypeScript 使用项目现有的两空格、单引号和分号风格。
- 不提交生成物、测试截图、环境变量、密钥或本机配置。
- 提交信息应清楚描述行为变化；推荐使用 `feat:`、`fix:`、`test:`、`docs:`、`chore:` 前缀。
- 新增第三方依赖前说明必要性和许可证，并更新 `THIRD-PARTY-LICENSES.md`。
- 修改交互界面时保留 NOTICE 中要求的品牌声明、原项目链接和修改说明。

## 许可证

提交到本仓库即表示你有权提供该贡献，并同意该贡献按 `AGPL-3.0-only` 许可。项目附加的品牌与归属要求见 [NOTICE](NOTICE)。
