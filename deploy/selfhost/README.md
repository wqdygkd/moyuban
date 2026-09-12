# 摸鱼办 · 自托管 Supabase（裁剪版）部署指南

在本项目自带的 Supabase 官方 Docker 部署基础上裁剪而成：**保留 6 个核心容器（约 1.2~1.6GB 内存，2GB 服务器即可稳定运行），移除摸鱼办用不到的 Storage / Realtime / Edge Functions / Supavisor 连接池**，代码与云端 Supabase 完全兼容，前端零改动。

## 一、方案说明

### 保留的容器

| 容器 | 镜像 | 作用 | 内存（粗估） |
|---|---|---|---|
| db | supabase/postgres | PostgreSQL 数据库（内置 auth / RLS 所需的全部 schema） | 300~500MB |
| rest | postgrest/postgrest | REST API（`/rest/v1/*`），前端所有数据读写走这里 | 30~50MB |
| auth | supabase/gotrue | 邮箱+密码登录、会话签发 | 50~100MB |
| meta | supabase/postgres-meta | Studio 的数据库管理接口 | 50~100MB |
| api-gw | kong/kong | API 网关：路由 + API Key 校验 + Studio 的 Basic Auth 保护 | 100~150MB |
| studio | supabase/studio | 网页控制台（建表、看数据、创建管理员账号） | 400~700MB |

### 移除的组件（官方完整版中有）

- **storage + imgproxy**：文件存储。摸鱼办图标存 URL，不用它。
- **realtime**：数据库实时推送。前端未使用。
- **functions**：Edge Functions 运行时。前端未使用。
- **supavisor**：数据库连接池。单体应用直连即可。
- **analytics/vector**（官方新版默认已不含）：日志分析。

数据库初始化脚本保留了 `roles.sql`（必需的角色）、`jwt.sql`（JWT 配置）、`webhooks.sql`（官方钩子结构）、`_supabase.sql`，与官方保持一致；移除了仅供被裁剪组件使用的 `logs.sql` / `realtime.sql` / `pooler.sql`。

## 二、前置要求

- 一台 **2GB 内存以上**的服务器（推荐 2C2G 以上，另加 2GB swap 兜底）
- Docker Engine 24+ 与 Docker Compose v2（`docker compose version` 能跑通即可）
- 两个域名（可选但强烈建议）：如 `nav.example.com`（前端）与 `supabase.example.com`（Supabase）
- 本项目两个文件：`supabase/schema.sql`（建表 + RLS + RPC）与 `supabase/seed.sql`（示例数据，可选）

## 三、目录结构

```
deploy/selfhost/
├── docker-compose.yml        # 裁剪版编排（6 个服务）
├── .env.example              # 环境变量模板
├── generate-keys.sh          # 一键生成全部密钥
├── .gitignore                # 排除 .env 与数据库数据目录
└── volumes/
    ├── api/
    │   ├── kong.yml          # 裁剪版路由声明（无 storage/realtime/functions）
    │   └── kong-entrypoint.sh# 官方入口脚本：注入密钥到 kong.yml
    ├── db/
    │   ├── _supabase.sql     # 官方初始化脚本
    │   ├── jwt.sql
    │   ├── roles.sql
    │   └── webhooks.sql
    ├── snippets/             # Studio 运行时挂载（保持为空即可）
    └── functions/            # 同上
```

## 四、部署步骤

### 1. 安装 Docker（已装可跳过）

以 Debian/Ubuntu 为例：

```bash
curl -fsSL https://get.docker.com | sh
docker compose version   # 确认 v2 可用
```

### 2. 上传部署目录

把本目录（`deploy/selfhost/`）连同本仓库的 `supabase/schema.sql`、`supabase/seed.sql` 一起传到服务器，例如放到 `/opt/moyuban/`：

```
/opt/moyuban/
├── selfhost/        # 即本目录
├── schema.sql
└── seed.sql
```

```bash
# 也可以在服务器上直接用 git 拉取仓库后拷贝
scp -r deploy/selfhost user@server:/opt/moyuban/selfhost
scp supabase/schema.sql supabase/seed.sql user@server:/opt/moyuban/
```

### 3. 生成密钥

```bash
cd /opt/moyuban/selfhost
cp .env.example .env
sh generate-keys.sh --update-env
```

脚本会用 openssl 生成 `JWT_SECRET`、`ANON_KEY`、`SERVICE_ROLE_KEY`、`POSTGRES_PASSWORD`、`DASHBOARD_PASSWORD`、`PG_META_CRYPTO_KEY` 并写回 `.env`（原文件备份为 `.env.old`）。

> 也可以在本地生成后再上传，但 `.env` 含密钥，注意不要提交到 git（本目录已配置 .gitignore）。

### 4. 配置 `.env` 中的人工项

`generate-keys.sh` 覆盖不到、**必须手动改**的变量：

| 变量 | 说明 | 直连服务器（无域名） | 配了域名 + HTTPS |
|---|---|---|---|
| `SUPABASE_PUBLIC_URL` | 浏览器/前端访问 Supabase 的地址 | `http://服务器IP:8000` | `https://supabase.example.com` |
| `API_EXTERNAL_URL` | Auth 对外地址，固定以 `/auth/v1` 结尾 | `http://服务器IP:8000/auth/v1` | `https://supabase.example.com/auth/v1` |
| `SITE_URL` | 摸鱼办前端站点地址 | `http://服务器IP` | `https://nav.example.com` |
| `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` | Studio 控制台登录账号 | 自行修改 | 自行修改 |

其余默认值已按摸鱼办的使用方式调好：

- `DISABLE_SIGNUP=true`：关闭自助注册（管理员账号在 Studio 手动创建）
- `ENABLE_EMAIL_AUTOCONFIRM=true`：Studio 建号直接生效，无需邮件验证
- `SMTP_*` 留空：只有需要邮箱验证/找回密码时才需要配置

### 5. 启动并验证

```bash
docker compose up -d
docker compose ps          # 等待 1~2 分钟，6 个容器均应为 healthy/running
docker compose logs -f     # 出问题时看日志
```

验证网关（应返回 `{"version":...}` 之类的 OpenAPI JSON，说明 REST 通了）：

```bash
curl "http://localhost:8000/rest/v1/" -H "apikey: $(grep '^ANON_KEY=' .env | cut -d= -f2)"
```

浏览器打开 `http://服务器IP:8000`，用 `DASHBOARD_USERNAME/PASSWORD` 登录 Studio。**如果 Supabase 公网暴露，请立即做完第八节的加固清单。**

### 6. 导入摸鱼办数据库

首次启动后（初始化脚本只在第一次建库时执行），导入本项目的表结构和示例数据：

```bash
cd /opt/moyuban
docker exec -i supabase-db psql -U postgres -d postgres < schema.sql   # 建表 + RLS + RPC
docker exec -i supabase-db psql -U postgres -d postgres < seed.sql     # 示例数据（可选）
```

验证：Studio → Table Editor 应能看到 `categories` / `subcategories` / `sites` / `app_meta` 四张表且有数据。

### 7. 创建管理员账号

Studio → **Authentication → Users → Add user**：

1. 填写邮箱 + 强密码
2. 勾选 **Auto Confirm User**
3. Create user

该账号即可在摸鱼办前端登录（RLS 授予写入权限）。之后如需关闭注册外的口子，确认 `DISABLE_SIGNUP=true` 已生效即可。

### 8. 部署前端

在本地/CI 构建静态文件（构建时注入 Supabase 地址与 anon key）：

```bash
cd moyuban
VITE_SUPABASE_URL=https://supabase.example.com \
VITE_SUPABASE_ANON_KEY=<.env 里的 ANON_KEY> \
pnpm build
```

把 `dist/` 上传到服务器（如 `/opt/moyuban/dist`），前端是纯静态站 + history 路由，nginx 参考配置：

```nginx
server {
    listen 80;
    server_name nav.example.com;
    root /opt/moyuban/dist;
    location / {
        try_files $uri $uri/ /index.html;   # SPA 路由回退
    }
}
```

## 五、HTTPS（推荐）

直接把 Caddy 指向 Kong 网关，自动签发证书：

```
# /etc/caddy/Caddyfile
supabase.example.com {
    reverse_proxy 127.0.0.1:8000
}

nav.example.com {
    root * /opt/moyuban/dist
    file_server
    try_files {path} /index.html
}
```

启用 HTTPS 后，回到 `.env` 同步修改并重启：

```bash
# .env
SUPABASE_PUBLIC_URL=https://supabase.example.com
API_EXTERNAL_URL=https://supabase.example.com/auth/v1
SITE_URL=https://nav.example.com

docker compose up -d   # 让 auth/kong/studio 重新读取
```

> 重新构建前端时 `VITE_SUPABASE_URL` 同样要换成 `https://supabase.example.com`。若不想为 Supabase 单独配域名，也可以在 `nav.example.com` 的反代里把 `/rest/v1`、`/auth/v1`、`/pg`、`/.well-known` 转发到 `127.0.0.1:8000`，其余走静态站（同域部署，此时三个 URL 都填 `https://nav.example.com`）。

## 六、安全加固清单

- [ ] `DASHBOARD_PASSWORD` 已改为强密码（Studio 直接暴露在 8000 端口下，靠它把门）
- [ ] `DISABLE_SIGNUP=true`（模板默认已是）
- [ ] 服务器防火墙只放行 80/443（和 22）；**8000 与 5432 端口不要对公网开放**——本编排未发布 5432，数据库只能通过 `docker exec` 或 SSH 隧道访问
- [ ] `.env` 权限收紧：`chmod 600 .env`
- [ ] 有条件的话在 Kong 前再挂一层反代（Caddy）并启用 HTTPS
- [ ] 定期备份（见下节）

## 七、日常维护

### 备份与恢复

```bash
# 备份（含 auth.users，即连同登录账号一起备份）
docker exec supabase-db pg_dump -U postgres -d postgres -Fc -f /tmp/moyuban.dump
docker cp supabase-db:/tmp/moyuban.dump ./moyuban-$(date +%F).dump

# 恢复到全新部署
docker cp ./moyuban-2026-09-12.dump supabase-db:/tmp/
docker exec supabase-db pg_restore -U postgres -d postgres --clean --if-exists /tmp/moyuban.dump
```

建议用 cron 每日备份并把 dump 同步到对象存储/异地。

### 升级

镜像版本钉死在 `docker-compose.yml` 顶部注释中，升级流程：

1. 打开 [官方 docker-compose.yml](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml)，核对本目录被裁剪的组件是否有变化，替换 `studio` / `auth` / `rest` / `meta` / `db` / `kong` 的镜像 tag
2. `docker compose pull && docker compose up -d`
3. GoTrue 等服务的 schema 迁移在容器启动时自动执行；Postgres 大版本升级（如 17→18）不能原地升，需用 dump/restore 迁移

### 常用命令

```bash
docker compose logs -f auth        # 看登录服务日志
docker compose restart auth        # 改完 .env 后重启对应服务
docker compose down                # 停止（数据保留在 volumes/db/data）
docker compose down -v             # 彻底重置（⚠️ 删除数据卷，重新走初始化）
```

## 八、故障排查

| 现象 | 原因 / 处理 |
|---|---|
| Studio 打不开或一直 unhealthy | 先等 20 秒预热；`docker compose logs studio`；2G 服务器确认 swap 已配置（内存不足会被 OOM kill） |
| 访问 8000 弹出浏览器登录框 | 正常，这是 Kong 对 Studio 的 Basic Auth，用 `DASHBOARD_USERNAME/PASSWORD` |
| 前端报 `Invalid API key` | `.env` 的 `ANON_KEY` 与构建前端时填的 `VITE_SUPABASE_ANON_KEY` 不一致，重新 build |
| 登录报 400/凭据错误 | 检查 `SUPABASE_PUBLIC_URL` 与 `API_EXTERNAL_URL` 是否一致（协议、域名都要对），改后 `docker compose restart auth kong studio` |
| 导入 schema.sql 报角色不存在 | 说明 db 容器初始化脚本未执行——多发生在 `down -v` 重置前挂载过数据目录；`docker compose down -v` 后重新 `up -d` 再导入 |
| psql 导入报 `already exists` | 表已建过，schema.sql 均为 `if not exists`，可忽略；或先 `drop table` 后重导 |
| REST 请求 404 | 检查 `PGRST_DB_SCHEMAS` 是否含 `public`，`docker compose restart rest` |

## 九、与官方完整版的差异（想加回组件时）

本目录 = 官方 `docker/` 目录的子集，恢复方法都是「把对应 service 加回 compose + 把路由加回 kong.yml」：

- **Storage**：加回 `storage`、`imgproxy` 服务与 `storage-v1` 路由，初始化脚本补上官方 `storage.sql`（首次建库时）
- **Realtime**：加回 `realtime` 服务与 `realtime-v1-*` 路由、`realtime.sql` 初始化脚本
- **Edge Functions**：加回 `functions` 服务与 `functions-v1` 路由

具体写法直接对照 [官方仓库 docker/ 目录](https://github.com/supabase/supabase/tree/master/docker) 同名文件即可，两边的容器名、网络、环境变量命名保持了一致，可平滑合并。
