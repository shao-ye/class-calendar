# 贡献指南

感谢你愿意参与 class-calendar。

## 开始之前

- 请先查看现有 Issue，避免重复工作。
- 涉及较大功能或数据结构变更时，建议先开 Issue 说明背景和方案。
- 不要提交真实密钥、真实数据库 ID、真实账号数据、孩子个人信息、照片或其他隐私数据。

## 本地开发

```bash
npm install
cp wrangler.toml.example wrangler.toml
cp worker-holidays/wrangler.toml.example worker-holidays/wrangler.toml
cp seed.example.sql seed.sql
npm run build
```

## 提交流程

1. 从最新 `master` 创建分支。
2. 保持改动聚焦，一次 Pull Request 解决一个主题。
3. 提交前运行 `npm run build`。
4. 如果改动了数据库结构，请补充 `migrations/` 迁移文件并更新相关文档。
5. 在 Pull Request 描述中说明改动内容、验证方式和潜在影响。

## 安全检查

提交前请确认以下文件没有被加入版本库：

- `.dev.vars`
- `wrangler.toml`
- `worker-holidays/wrangler.toml`
- `seed.sql`
- `.wrangler/`
- `dist/`
- `node_modules/`

如果误提交了敏感信息，请立即撤销提交、轮换相关密钥，并在必要时清理 Git 历史。
