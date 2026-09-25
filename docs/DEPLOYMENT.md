# Cloudflare 独立部署

使用 React / Next.js App Router API、vinext、Workers 和 D1。版本由锁文件固定，不需要原网站配置或账号。

```sh
npm ci
npx wrangler login
npx wrangler d1 create xia-realm-companion
```

将返回数据库 ID 填入 `wrangler.json` 的 `d1_databases[0].database_id`，绑定名保持 `DB`。Worker 和数据库名称可改。ID 是资源标识，不是令牌；API token 不应写进配置或 Git。

```sh
npm run db:remote
npm run deploy
```

部署脚本拒绝占位数据库 ID，先构建，再发布 `dist/server/wrangler.json` 对应的 Worker 和静态资源。Wrangler 返回自己的地址；首次打开是空团。这不会连接维护者的数据库。

私有包使用 `XIA_CONTENT_PACK`，见[资料包](CONTENT-PACKS.md)。部署资料会提供给访问者，需先确定分享范围。

## 更新

1. 队伍页导出本团 JSON，保存到仓库外；也可用 `wrangler d1 export` 备份整库。
2. 拉取代码，`npm ci`、`npm run typecheck`、`npm test`。
3. 如有新迁移先在本地验证，再运行 `npm run db:remote`。
4. 用原 Worker 和数据库 ID 部署；资料包版本变化先在独立库测试旧卡。

本仓库 Actions 只检查原创演示，不部署网站，也不需要任何云端密钥。

## 访问

单团共享模式中，拿到链接的人都能读写，包括切换 DM。DM 是视图，不构成身份验证；API 没有账号隔离。投屏只控制画面，不是授权边界。

需要私密访问时可在部署层添加访问控制，包含 `/api/*`、`/modules/*`、`/screen` 等路径。公开注册或多团服务需另做身份、权限、数据隔离。

## 排查

- `no such table: campaigns`：本地执行 `npm run db:local`，远程执行 `npm run db:remote`。
- 缺少生成资料：执行 `npm run content:prepare`；正常安装、开发、构建都会自动运行。
- 旧缓存：刷新让 service worker 更新；必要时清理该站点缓存，先保留本机草稿。
- 端口占用：停止另一服务，或 `npm run dev -- --port 5186`。

vinext 当前使用 beta 版；升级须验证开发、Worker 构建、D1 读写和打印，不仅是静态页面。
