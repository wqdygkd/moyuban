# 摸鱼办

基于 **Vue 3 + Element Plus + Supabase** 的网址导航网站。前端直连 Supabase，后端由 PostgreSQL + Auth 鉴权 + RLS 行级安全提供，部署即完整运行。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/wqdygkd/moyuban&env=VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY&project-name=moyuban&repository-name=moyuban) [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/wqdygkd/moyuban)

> 仓库：https://github.com/wqdygkd/moyuban

## 技术栈

- 前端：Vue 3 `<script setup>` + Vue Router + Element Plus + Vite
- 后端：Supabase（PostgreSQL + Auth + RLS）

## 功能

- **导航首页**：顶部搜索区（本站/百度/必应/谷歌）、左侧全部分类导航（滚动高亮 + 移动端抽屉）、分类区块（子分类标签 + 网址卡片网格）、底部友情链接。
- **网站维护**（登录后）：
  - 网址管理：增 / 删 / 改 / 搜索 / 按分类筛选，标记首页推荐、热门、最新。
  - 分类管理：主分类增删改。
  - 子分类管理：子分类增删改。
- **权限**：游客只读浏览；登录用户（Supabase Auth 邮箱+密码）通过 RLS 获得写入权限。

---

## 🚀 完整部署流程

先完成 Supabase 必备准备，再任选一个平台部署，约 10 分钟上线，浏览器内即可完成全部步骤。

## 一、Supabase 必备准备（所有部署方式共用）

> 此章节完成一次即可，后续 Vercel / Netlify 共用同一套数据库与账号。

### 1. 创建项目

1. 登录 [supabase.com](https://supabase.com) → `New project`。
2. 选择组织 → 填写 `Project name`（如 `moyuban`）→ 设置 `Database Password`（牢记，后续 CLI 使用）→ 选择距离最近的 `Region`（如 `Singapore`）→ `Create new project`。
3. 等待约 1-2 分钟，状态变为 `Active` 即创建完成。

### 2. 初始化数据库（建表 + 导入示例数据）

二选一，推荐 A，浏览器粘贴即可完成。

#### A. SQL Editor 粘贴（推荐）

1. 进入 Supabase 项目 → 左侧 `SQL Editor` → `New query`。
2. 打开本仓库 `supabase/schema.sql`，全选复制 → 粘贴到 SQL Editor → 点击 `Run`（或 `Ctrl+Enter`）。看到 `Success. No rows returned` 即成功（创建 3 张表 + RLS + RPC）。
3. 同样方式，新建一个 Query，复制 `supabase/seed.sql` 全部内容 → `Run`（导入 12 个主分类 / 50+ 子分类 / 160+ 示例网址，执行约 5-10 秒）。

#### B. Supabase CLI 推送（适合已安装 CLI 的开发者）

```bash
# 1. 安装 CLI
pnpm add -g supabase        # 或: brew install supabase/tap/supabase / scoop install supabase
# 已安装的同学直接进入下一步

# 2. 浏览器登录一次
supabase login

# 3. 关联云端项目（首次执行）
# <project-ref> 位于 Supabase 控制台 Project Settings -> General -> Reference ID
# 提示输入第 1 步设置的 Database Password
supabase link --project-ref <project-ref>

# 4. 推送（本项目 config.toml 已配置 schema.sql + seed.sql）
supabase db push
# 提示确认时输入 y 回车
```

> A 与 B 选择其一完成初始化即可；`supabase db push` 自动跳过已应用的迁移。

**验证**：左侧 `Table Editor` 出现 `categories` / `subcategories` / `sites` 三张表且包含数据。

### 3. 配置 Auth 并获取密钥

1. **创建管理员账号**：
   `Authentication` → `Users` → `Add user` → `Create new user` → 填写邮箱 + 密码 → 勾选 `Auto Confirm User` → `Create user`。
2. **加固（建议）**：
   - `Authentication` → `Providers` → `Email` → 关闭 `Confirm email`，开启后可实现邮箱验证登录。
   - 同一页面关闭 `Allow new users to sign up`，服务端进一步限制注册。
3. **复制密钥**（下一步部署时填入）：
   `Project Settings` → `API Keys` → 复制
   - `Project URL` → 对应 `VITE_SUPABASE_URL`（如 `https://abcdefgh.supabase.co`）
   - `Publishable key`（`sb_publishable_...`）→ 对应 `VITE_SUPABASE_PUBLISHABLE_KEY`（新版推荐，`Legacy API Keys` 中的 `anon` 仍可兼容使用）
   > 妥善保存；`Secret key` / `service_role` 仅服务端使用，保持私密。

---

## 二、部署到 Vercel

> 依赖 GitHub 账号授权克隆 https://github.com/wqdygkd/moyuban

### 方式一：一键按钮（自动创建副本，推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/wqdygkd/moyuban&env=VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY&project-name=moyuban&repository-name=moyuban)

Vercel 引导完成 GitHub 授权 → 自动在你的账号创建一份 `moyuban` 仓库副本 → 进入部署页填写环境变量（`Publishable key` 对应 `VITE_SUPABASE_PUBLISHABLE_KEY`，旧版 `anon` 对应 `VITE_SUPABASE_ANON_KEY` 也兼容）。已 Fork 的同学也可选择自己的 Fork 导入。

### 方式二：手动导入

1. 登录 [vercel.com](https://vercel.com) → `Add New...` → `Project` → `Import` 你的 `moyuban` 仓库（Vercel 自动创建的副本或手动 Fork 的，均通过 GitHub 完成授权）。
2. `Framework Preset` 保持 `Vite`（自动识别 `pnpm build` → `dist`），保持默认配置。
3. 展开 `Environment Variables`，添加：
   ```
   VITE_SUPABASE_URL=https://你的项目.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=你的 Publishable key（sb_publishable_...）
   ```
   三个环境（Production / Preview / Development）保持勾选。
4. 点击 `Deploy`，等待约 1 分钟，获得 `https://moyuban-xxx.vercel.app` 公网地址。

> 本项目为 SPA（`createWebHistory`），仓库已内置 `vercel.json` 将所有路由重写到 `/index.html`，刷新 `/admin` / `/login` 保持正常访问。

### 方式三：CLI 直接部署

适合偏好本地推送的同学：

```bash
# 1. 获取代码
git clone https://github.com/wqdygkd/moyuban.git
cd moyuban
# 也支持从 GitHub 页面 Download ZIP 解压后进入目录

# 2. 安装 Vercel CLI
pnpm add -g vercel   # 或 pnpm dlx vercel --prod

# 3. 登录并部署（首次根据提示回车选择默认配置）
vercel login
vercel --prod         # 按提示：Set up and deploy? Y → 选择 Hobby → 设置项目名

# 4. 配置环境变量（二选一）
# A. Vercel 控制台：Project → Settings → Environment Variables 添加后 Redeploy
# B. 命令行：
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
vercel --prod   # 再次部署使变量生效
```

后续更新：本地修改后再次执行 `vercel --prod` 即完成上线。

---

## 三、部署到 Netlify

> 依赖 GitHub 账号授权导入 https://github.com/wqdygkd/moyuban，仓库已内置 `netlify.toml`，构建与重定向开箱可用。

### 方式一：一键按钮（推荐）

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/wqdygkd/moyuban)

点击按钮 → 完成 GitHub 授权 → Netlify 自动创建仓库关联 → 在部署页填入环境变量后完成部署。

### 方式二：手动导入

1. 登录 [app.netlify.com](https://app.netlify.com) → `Add new site` → `Import an existing project` → 选择 `GitHub` 并授权 → 选中 `moyuban`。
2. 构建配置保持默认（`netlify.toml` 已预设）：
   - Build command: `pnpm build`
   - Publish directory: `dist`
3. 点击 `Show advanced` → `Add environment variables`，添加：

   ```txt
   VITE_SUPABASE_URL=https://你的项目.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=你的 Publishable key（sb_publishable_...）
   ```

4. 点击 `Deploy site`，等待约 1 分钟，获得 `https://xxx.netlify.app` 公网地址。

> SPA 重定向已在 `netlify.toml` 配置 `/* → /index.html 200`，刷新 `/admin` / `/login` 保持正常访问。

### 方式三：CLI 直接部署

```bash
# 1. 获取代码
git clone https://github.com/wqdygkd/moyuban.git
cd moyuban

# 2. 安装 Netlify CLI
pnpm add -g netlify-cli
# 或 pnpm dlx netlify-cli deploy

# 3. 登录
netlify login        # 浏览器完成 GitHub/邮箱授权

# 4. 初始化并部署
netlify init         # 按提示选择 Create & configure a new site → 保持构建配置默认
netlify env:set VITE_SUPABASE_URL https://你的项目.supabase.co
netlify env:set VITE_SUPABASE_PUBLISHABLE_KEY 你的Publishable key
netlify deploy --prod   # 首次构建并发布

# 再次发布
netlify deploy --prod
```

> 也支持 `Download ZIP` 后解压进入目录再执行 `netlify deploy --prod`。

---

## 四、验证与后续管理

1. **访问首页**：打开平台分配的域名，查看分类与网址卡片（来自 `seed.sql`）。
2. **登录后台**：访问 `https://你的域名/login` → 使用 Supabase 章节创建的邮箱密码登录 → 自动跳转 `/admin`，开始增删改数据。
3. **更新网站**：
   - Git 托管部署：本地或 GitHub 网页端修改后 `git push` 到 `main`，平台自动重新部署。
   - CLI 部署：本地修改后再次执行 `vercel --prod` 或 `netlify deploy --prod`。
4. **修改环境变量**：
   - Vercel：`Settings` → `Environment Variables` → 修改后 `Deployments` → `Redeploy` 生效。
   - Netlify：`Site configuration` → `Environment variables` → 修改后 `Deploys` → `Trigger deploy` 生效。
5. **绑定自定义域名**：
   - Vercel：`Settings` → `Domains` → 输入域名 → 按提示添加 `CNAME` / `A` 记录。
   - Netlify：`Domain management` → `Add custom domain` → 按提示添加记录。

## 五、常见问题

| 现象                                           | 原因 / 解决                                                                                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 首页空白 / 控制台 401                          | `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` 填写有误或未重新部署；核对平台环境变量与 Supabase `Project Settings → API Keys → Publishable key` 是否一致 |
| `permission denied for table sites`            | `schema.sql` 未完整执行或 RLS/GRANT 缺失；重新执行 `schema.sql`                                                                                                  |
| 登录提示 `Invalid login credentials`           | 账号未创建或未勾选 `Auto Confirm`；前往 `Authentication → Users` 重建并确认邮箱已验证                                                                            |
| 刷新 `/admin` 404                              | 检查项目根目录是否包含 `vercel.json` / `netlify.toml` 且已推送                                                                                                   |
| Windows `supabase` 命令报 `No matching binary` | PATH 被 pnpm 全局的旧 CLI 占用：执行 `pnpm remove -g supabase` 后使用 scoop/brew 安装的版本，`supabase --version` 验证                                           |

---

## 本地开发（可选）

```bash
# 1. 克隆
git clone https://github.com/wqdygkd/moyuban.git
cd moyuban

# 2. 环境变量（复制模板并填入 Supabase 章节获取的两个值）
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux

# 3. 安装并启动
pnpm install
pnpm dev      # http://localhost:5174
pnpm build    # 构建
pnpm preview  # 预览构建产物
```

## 目录结构

```txt
├─ supabase/
│  ├─ schema.sql        # 表结构 + RLS + GRANT + RPC（SQL Editor 执行）
│  ├─ seed.sql          # 全量示例数据（分类/子分类/网址，schema 之后执行）
│  └─ config.toml       # Supabase CLI 本地配置
├─ vercel.json          # Vercel SPA 重写：/(.*) → /index.html
├─ netlify.toml         # Netlify 构建 + SPA 重定向：/* → /index.html 200
├─ src/
│  ├─ lib/supabase.js   # Supabase 客户端
│  ├─ store/auth.js     # 登录状态 (Pinia)
│  ├─ services/api.js   # 分类/子分类/网址接口封装
│  ├─ router/index.js   # 路由 + 登录守卫
│  ├─ components/       # SiteHeader、SiteFooter、SiteCard
│  └─ views/            # HomeView、LoginView、admin/
└─ .env.example         # 环境变量示例
```

## 数据库模型

| 表              | 说明     | 关键字段                                                                                                                                      |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `categories`    | 主分类   | name, slug, icon, sort_order                                                                                                                  |
| `subcategories` | 子分类   | category_id→categories, name, sort_order                                                                                                      |
| `sites`         | 网址条目 | subcategory_id→subcategories, name, url, description, favicon_url, image_url, is_hot, is_new, is_featured, click_count, sort_order, is_active |

**权限（RLS）**：所有表 `select` 对所有人开放；`insert/update/delete` 授予 `authenticated`（已登录）用户。另有 `increment_click(uuid)` RPC 支持匿名累计点击量。
