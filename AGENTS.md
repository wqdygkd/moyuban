# AGENTS.md

面向 AI 编码代理的项目说明。修改代码前请先读完「关键约定」一节。

## 项目概览

**摸鱼办（moyuban）**：基于 Vue 3 + Element Plus + Supabase 的网址导航网站。前端直连 Supabase（无自建后端），权限由 PostgreSQL RLS 行级安全控制：游客只读，Supabase Auth（邮箱+密码）登录用户可写。部署即完整运行（Vercel / Netlify 一键部署，PWA 离线可用）。

## 常用命令

包管理器使用 **pnpm**。项目没有测试框架。

```bash
pnpm dev          # Vite 开发服务器（会生成 auto-imports.d.ts 等文件）
pnpm build        # vue-tsc --noEmit && vite build（含类型检查）
pnpm typecheck    # 仅 vue-tsc --noEmit
pnpm lint         # ESLint 检查
pnpm lint:fix     # ESLint 自动修复
```

提交前至少跑 `pnpm lint:fix` 和 `pnpm typecheck`（等价于 build 的前半步）。

## 技术栈

- Vue 3.5 `<script setup>` + TypeScript（strict）+ Vite 8
- vue-router 5、Element Plus 2.8（按需自动引入，样式走 sass）
- Supabase JS v2（PostgreSQL + Auth + RLS）
- PWA：vite-plugin-pwa（autoUpdate）
- functional 辅助：fuse.js（站内本地检索）、sortablejs（拖拽）、fractional-indexing（排序键）
- 样式：sass-embedded（仅 modern API），`src/styles/`

## 目录结构

```
src/
  components/    # SiteCard、SiteHeader、SiteSearch、ThemeSwitcher、FaviconField/Img 等
  composables/   # use-crud-table、use-drag-order、use-home-data、use-pagination、use-site-search
  lib/supabase.ts        # 类型化 SupabaseClient（Database 接口对齐 schema.sql）+ requireSupabase()
  services/api.ts        # 三张表的 CRUD 封装（写操作统一走 withSession）
  services/import-api.ts # 后台数据导入
  store/auth.ts          # 模块级单例响应式 auth store（useAuthStore）
  router/index.ts        # 路由 + 登录守卫（requiresAuth / guestOnly）
  types/index.ts         # DB 行类型，必须与 supabase/schema.sql 对齐
  utils/         # cache、clipboard、confirm、favicon、group、order、search、theme
  views/         # HomeView、CategoryView、SearchView、LoginView、admin/*（四个管理页）
supabase/schema.sql      # 全量建库脚本：3 张表 + app_meta + RLS + RPC(increment_click)
```

路径别名：`@` → `src/`。

## 关键约定（容易踩坑）

1. **自动导入的边界**：vue / vue-router 的 API（`ref`、`computed`、`useRoute` 等）由 unplugin-auto-import 隐式提供，**不要手写这些 import**；但 Element Plus 的脚本 API（`ElMessage`、`ElMessageBox` 等）**必须手写** `import { ElMessage } from 'element-plus'`，漏写会被 eslint `no-undef` 拦下。模板中的 `el-*` 标签和 `v-loading` 指令由 unplugin-vue-components 自动解析，无需手动注册。

2. **生成文件要提交**：`src/auto-imports.d.ts`、`src/components.d.ts`、`.eslintrc-auto-import.json` 都是插件产物，但已纳入版本控制（eslint.config.js 读取后者识别全局变量）。刚克隆就跑 lint 报 no-undef 时，先跑一次 dev/build 让它生成。

3. **src/types 下只能用 `type` 不能用 `interface`**：supabase-js 的 GenericTable 要求 Row/Insert/Update 满足 `Record<string, unknown>`，interface 没有隐式索引签名会退化成 never。该规则由 eslint.config.js 对 `src/types/**` 强制。

4. **schema、types、Database 三处同步**：改数据库结构时，`supabase/schema.sql`、`src/types/index.ts`（行类型）、`src/lib/supabase.ts`（Database 接口）必须一起改，并用 `pnpm typecheck` 验证。

5. **排序键（sort_order）**：字符串型 fractional 索引键（fractional-indexing，BASE_62），字典序即展示序。拖拽排序只写被移动的那一条（见 `src/utils/order.ts` 的 appendOrderKey），不要整表重写。

6. **写操作一律走 services/api.ts**：`withSession` 会先确认本地仍有 session（避免以 anon 身份发请求），并把 PostgREST 错误映射为友好文案。**遇到 42501 / permission denied 不要给 anon 放权**——那是线上库表级权限或 RLS 策略缺失，正确做法是重新执行 `supabase/schema.sql`。

7. **Supabase client 可能为 undefined**：`.env` 缺配置时 `src/lib/supabase.ts` 导出的 client 是 undefined（只在控制台告警）。写操作和查询用 `requireSupabase()` 拿非空实例。

8. **auth store 是模块级单例**：用 `useAuthStore()` 获取，内部用 `reactive` 包 ref（嵌套 ref 自动解包，模板里直接拿原始值）。不要引入 Pinia 或另建实例。

9. **构建配置有讲究，改前看注释**：`vite.config.ts` 里 `cssCodeSplit: false`（home.scss 被三个路由共享，拆分会缺样式）、manualChunks 手动分包、PWA 缓存策略，均附有原因注释；`eslint.config.js` 同样。

10. **ESLint 风格**：@antfu/eslint-config（stylistic + formatters + unicorn 全推荐），1tbs 花括号、无分号风格由规则约定，不要手工对齐——跑 `pnpm lint:fix`。

## 环境变量

复制 `.env.example` 为 `.env` 并填入 Supabase 控制台的值：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`（新版 publishable key，推荐；与旧版 `VITE_SUPABASE_ANON_KEY` 二选一，代码优先读前者）

`.env` 不入库。缺配置时应用仍能启动（游客态），写操作会报「Supabase 未配置」。

## 数据库

- 全量结构见 `supabase/schema.sql`（幂等，可在 Supabase SQL Editor 直接重跑）；`supabase/config.toml` 已配置 CLI `supabase db push` 指向该文件。
- 表：`categories` → `subcategories`（级联删除）→ `sites`，另有 `app_meta`（版本号）与 RPC `increment_click`。
- 无种子数据：分类和网址由管理员登录 `/admin` 后台添加。
- 权限模型：anon 只读（SELECT），authenticated 可写；由 RLS + 表级 GRANT 共同控制。

## 代码风格补充

- 中文注释，注释解释「为什么」而非「做什么」——新增代码请保持同等密度和口径。
- 提交信息用中文，格式如 `feat: 站内搜索（fuse.js 本地检索、即时建议与结果页）`。
- 根目录 `DESIGN.md` 是设计文档，改 UI 前先对照。
