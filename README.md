# 课程小日历（class-calendar）

孩子每日课程记录日历工具。技术栈：Vue 3 + Vite（前端）/ Cloudflare Pages Functions（后端）/ D1（数据库）/ R2（图片）。

需求与原型见 `doc/` 与 `prototype/`。

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 初始化本地 D1 表结构
npm run db:init

# 3. 写入默认登录用户（用户名 parent / 密码 123456）
npm run db:seed

# 4. 启动开发服务（Vite + Functions + D1 本地绑定）
npm run dev
```

启动后访问 wrangler 输出的本地地址（通常 http://localhost:8788）。默认账号 `parent` / `123456`。

## 重新生成密码哈希

```bash
node scripts/gen-hash.mjs 你的新密码
# 把输出的哈希替换进 seed.sql 后重新执行 npm run db:seed
```

## 部署到 Cloudflare（后续）

1. 在 Cloudflare 创建 D1 库，把真实 `database_id` 填入 `wrangler.toml`
2. 远程建表：`wrangler d1 execute class_calendar --remote --file=./schema.sql`
3. 用 `wrangler pages secret put SESSION_SECRET` 设置会话密钥
4. 连接 Git 仓库由 Pages 自动构建（构建命令 `npm run build`，输出目录 `dist`）
5. 在 Pages 自定义域名绑定 `class.shaoruiyi.com`
