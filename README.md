# 课程小日历 class-calendar

孩子每日课程、课包消耗、上课记录和照片归档的小型日历工具。

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages%20%7C%20D1%20%7C%20R2-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/)

技术栈：Vue 3 + Vite、Cloudflare Pages Functions、Cloudflare D1、Cloudflare R2，以及一个可选的 Cloudflare Worker 用于节假日同步。

> 在线体验：<https://class.shaoruiyi.com>
> 公开体验账号：用户名 `parent` / 密码 `123456`（仅供试用，数据可能被随时清理，请勿录入真实隐私信息）

## 功能概览

- 日历视图：按日期查看课程安排、上课记录和请假/补课信息
- 课程管理：维护课程、课包、剩余课时和备注
- 记录统计：查看近期课程消耗和上课趋势
- 照片归档：通过 R2 保存课程相关照片
- 账号登录：基于用户名密码和签名 Cookie 的轻量认证
- 节假日同步：可选 Worker 定时同步法定节假日

## 界面预览

| 日历视图 | 统计分析 |
| --- | --- |
| ![日历视图](https://image.5202021.xyz/api/rfile/calendar.png) | ![统计分析](https://image.5202021.xyz/api/rfile/stats.png) |

| 课程库 | 当日记录 |
| --- | --- |
| ![课程库](https://image.5202021.xyz/api/rfile/courses.png) | ![当日记录](https://image.5202021.xyz/api/rfile/record.png) |

## 开源与安全声明

本仓库不包含可直接使用的生产密钥、真实数据库 ID、真实口令哈希或本地调试环境变量。以下文件只应保留在本地，已经被 `.gitignore` 排除：

- `.dev.vars`
- `wrangler.toml`
- `worker-holidays/wrangler.toml`
- `seed.sql`

请从对应的 `.example` 文件复制后填入自己的配置：

- `wrangler.toml.example`
- `worker-holidays/wrangler.toml.example`
- `seed.example.sql`

公开部署前请重新生成 `SESSION_SECRET`、`SYNC_KEY`、用户密码哈希，并确认 Cloudflare D1/R2 资源归属于你自己的账号。

## 快速开始

```bash
npm install

cp wrangler.toml.example wrangler.toml
cp worker-holidays/wrangler.toml.example worker-holidays/wrangler.toml
cp seed.example.sql seed.sql

node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" > .dev.vars
node scripts/gen-hash.mjs "你的登录密码"
```

把生成的密码哈希写入 `seed.sql` 后初始化本地 D1：

```bash
npm run db:init
npm run db:seed
```

本地开发通常需要两个终端：

```bash
npm run build
npm run server
```

```bash
npm run ui
```

访问 `http://localhost:5173`。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run ui` | 启动 Vite 开发服务 |
| `npm run build` | 构建前端静态资源 |
| `npm run server` | 启动 Cloudflare Pages Functions 本地服务 |
| `npm run deploy` | 构建并部署 Cloudflare Pages |
| `npm run db:init` | 初始化本地 D1 表结构 |
| `npm run db:seed` | 写入本地种子用户 |
| `npm run db:init:remote` | 初始化远程 D1 表结构 |
| `npm run db:seed:remote` | 写入远程种子用户 |
| `npm run genhash` | 生成密码哈希 |

## 文档

- [需求设计文档](doc/需求设计文档.md)
- [项目架构文档](doc/项目架构文档.md)
- [开发设计文档](doc/开发设计文档.md)
- [部署说明文档](doc/部署说明文档.md)

早期可点击原型位于 `prototype/`。

## 部署摘要

完整步骤见 [部署说明文档](doc/部署说明文档.md)。概要如下：

1. 创建 D1：`wrangler d1 create class_calendar`
2. 将自己的 `database_id` 写入本地 `wrangler.toml` 和 `worker-holidays/wrangler.toml`
3. 初始化远程表结构和种子数据：`npm run db:init:remote`、`npm run db:seed:remote`
4. 创建 R2 bucket：`wrangler r2 bucket create class-photos`
5. 在 Cloudflare Pages 配置 `SESSION_SECRET`
6. 部署 Pages：`npm run deploy`
7. 如需节假日同步，部署 `worker-holidays/` 并配置 `SYNC_KEY`

## 贡献

欢迎通过 Issue 和 Pull Request 参与改进。提交前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，并确保没有提交本地密钥、真实配置、真实账号数据或个人隐私数据。

## 许可证

本项目基于 [MIT License](LICENSE) 开源。
