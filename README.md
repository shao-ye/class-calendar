# 课程小日历（class-calendar）

孩子每日课程记录日历工具。技术栈：Vue 3 + Vite（前端）/ Cloudflare Pages Functions（后端）/ D1（数据库）/ R2（图片）。

文档见 `doc/`：[需求设计](doc/需求设计文档.md)、[项目架构](doc/项目架构文档.md)、[开发设计](doc/开发设计文档.md)、[部署说明](doc/部署说明文档.md)；早期可点击原型见 `prototype/`。

> 仓库不含任何密钥与账号特定 ID。`wrangler.toml`、`worker-holidays/wrangler.toml`、`seed.sql`、`.dev.vars` 均被 gitignore，请从对应 `.example` 模板复制后填写。

## 首次准备

```bash
# 1. 安装依赖
npm install

# 2. 复制配置模板并填写
cp wrangler.toml.example wrangler.toml                       # 填 database_id
cp worker-holidays/wrangler.toml.example worker-holidays/wrangler.toml
cp seed.example.sql seed.sql                                  # 填密码哈希（见下）
printf 'SESSION_SECRET=%s\n' "$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" > .dev.vars

# 3. 生成密码哈希，替换进 seed.sql 的 password_hash
node scripts/gen-hash.mjs '你的密码'
```

## 本地开发

```bash
npm run db:init     # 本地 D1 建表
npm run db:seed     # 写入登录用户
# 两个终端：
npm run server      # wrangler pages dev dist（Functions + D1 + R2，需先 npm run build 生成 dist）
npm run ui          # vite(5173)，/api 代理到 8788，热更新
```

访问 `http://localhost:5173` 登录使用。

## 部署到 Cloudflare

完整步骤见 [部署说明文档](doc/部署说明文档.md)。概要：

1. `wrangler d1 create class_calendar` → 把 `database_id` 填进 `wrangler.toml`
2. 远程建表与种子：`npm run db:init:remote`、`npm run db:seed:remote`
3. `wrangler r2 bucket create class-photos`
4. 创建 Pages 项目并设置 `SESSION_SECRET`
5. `npm run deploy`（构建 + 部署）
6. 绑定自定义域名；部署定时同步 Worker（`worker-holidays/`）
