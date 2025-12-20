# Cloudflare Pages 部署（支持“分享链接 / 跨设备同步”）

这份文档面向后端新手，按步骤做即可把项目部署到 Cloudflare，并让“照片 + 回忆（备注/评论）+ 主题”通过分享链接在不同设备同步。

## 你需要准备什么
- 一个 Cloudflare 账号
- 代码已经推到 GitHub（Cloudflare Pages 需要从 Git 拉取）
- 本机已安装 Node.js（建议 v18+）

## 一次性创建云端资源（D1 + R2）
你可以用 Cloudflare 控制台创建（推荐），也可以用命令行创建。

### 方式 A（推荐）：在 Cloudflare 控制台创建
1. 创建 D1 数据库：`Workers & Pages` → `D1` → `Create database`
   - 数据库名建议：`grand-tree`
2. 创建 R2 Bucket：`R2` → `Create bucket`
   - Bucket 名建议：`grand-tree-photos`

### 方式 B：用 Wrangler 命令创建
在项目根目录运行：
- `npm install`
- `npx wrangler login`
- 创建 D1：`npx wrangler d1 create grand-tree`
- 创建 R2：`npx wrangler r2 bucket create grand-tree-photos`

记下 `d1 create` 输出里的 `database_id`（后面会用到）。

## 创建 Pages 项目并配置构建
1. Cloudflare 控制台：`Workers & Pages` → `Pages` → `Create a project` → 连接 GitHub 仓库
2. 构建配置（最重要）：
   - `Build command`: `npm run build`
   - `Build output directory`: `dist`
   - Root directory: 选仓库根目录（默认即可）
3. 如果构建失败提示 Node 版本过低：在 Pages 项目 `Settings` → `Environment variables` 添加 `NODE_VERSION=20`（或 18+）

## 给 Pages Functions 绑定 D1/R2（必须做）
Pages 的后端接口在 `functions/` 目录里，会用到两个绑定变量名：
- D1：`DB`
- R2：`BUCKET`

在 Cloudflare 控制台进入你的 Pages 项目：
1. `Settings` → `Functions` → `Bindings`
2. 添加：
   - `D1 database`：变量名填 `DB`，选择你创建的 D1（例如 `grand-tree`）
   - `R2 bucket`：变量名填 `BUCKET`，选择你创建的 R2（例如 `grand-tree-photos`）
3. 保存后，触发一次重新部署（`Deployments` 里点 `Retry` 或 push 一次提交）

## 初始化 D1 数据库表（必须做一次）
目前数据库只有 1 张表 `shares`，SQL 在 `migrations/0001_create_shares.sql`。

### 推荐做法：用 `wrangler.toml.example` 临时生成本地配置（不会提交到 git）
1. 复制配置文件：
   - `cp wrangler.toml.example wrangler.toml`
2. 编辑 `wrangler.toml`：
   - 把 `database_id` 改成你自己的 D1 `database_id`
3. 执行建表（远端）：
   - `npx wrangler d1 execute DB --remote --file migrations/0001_create_shares.sql`

执行成功后就完成了。

## 验证是否生效（两台设备）
1. 打开你的 Pages 域名（例如 `https://xxx.pages.dev/`）
2. 在页面里点击 `生成分享链接`
3. 点击 `复制链接`，把链接发给朋友/另一台设备
4. 在另一台设备打开该链接（注意链接里会带 `?s=...`）
5. 任意修改（上传照片、改主题、写备注/评论）后刷新页面，应该能看到同步结果

## 常见问题排查
- 接口返回 `服务端未配置数据库（D1）`：你没绑定 `DB`，或只绑了 Preview 没绑 Production（反之亦然）
- 接口返回 `服务端未配置对象存储（R2）`：你没绑定 `BUCKET`
- 点击 `生成分享链接` 失败：通常是 D1 表没建好（执行一次 `migrations/0001_create_shares.sql`）
- 朋友打开链接看不到同一棵树：确认打开的是带 `?s=` 的链接，而不是主页

## 安全提醒（重要）
当前版本是“拿到链接的人都可查看和修改全部内容”。把分享链接当作密码，不要公开到论坛/群公告等场景。
