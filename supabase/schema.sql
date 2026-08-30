-- ============================================================
-- 摸鱼办 · Supabase 数据库初始化脚本 (schema.sql)
-- 执行本文件以创建表结构、行级安全策略与表级权限。
-- 需要先启用 Supabase Auth (email + password)。
-- 随后执行 seed-full.sql 导入全量种子数据（分类/子分类/网址）。
-- ============================================================

-- ---------- 扩展 ----------
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 主分类 categories
-- 例如：生活服务 / AI智能库 / 实用工具 / ...
-- ------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                -- 分类名称
  slug        text not null unique,         -- 英文标识，用于路由/查询
  icon        text,                         -- 分类图标(可空)
  description text,
  sort_order  int not null default 0,       -- 排序
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 子分类 subcategories
-- 例如：智能推荐 > 热门/最新；生活服务 > 即时资讯/社交社区 ...
-- ------------------------------------------------------------
create table if not exists public.subcategories (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories(id) on delete cascade,
  name         text not null,               -- 子分类名称
  slug         text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 网址条目 sites
-- 每条记录一个导航网址
-- ------------------------------------------------------------
create table if not exists public.sites (
  id             uuid primary key default gen_random_uuid(),
  subcategory_id uuid references public.subcategories(id) on delete cascade,
  name           text not null,             -- 站点名称
  url            text not null,             -- 站点链接
  description    text,                      -- 一句话简介
  favicon_url    text,                      -- 站点 favicon URL
  image_url      text,                      -- 卡片展示大图(可空)
  is_hot         boolean not null default false, -- 智能推荐-热门
  is_new         boolean not null default false, -- 智能推荐-最新
  is_featured    boolean not null default false, -- 首页置顶推荐(智能推荐区)
  click_count    bigint not null default 0, -- 点击次数
  sort_order     int not null default 0,    -- 组内排序
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_sites_subcategory on public.sites(subcategory_id);
create index if not exists idx_subcategories_category on public.subcategories(category_id);

-- ------------------------------------------------------------
-- 行级安全性 (RLS)
-- 读取：所有人可见
-- 写入：仅登录用户(Supabase Auth)可增删改
-- ------------------------------------------------------------
alter table public.categories     enable row level security;
alter table public.subcategories  enable row level security;
alter table public.sites          enable row level security;

-- 所有人可读
create policy "public read categories"    on public.categories    for select using (true);
create policy "public read subcategories" on public.subcategories for select using (true);
create policy "public read sites"         on public.sites         for select using (true);

-- 仅登录用户可写
create policy "auth write categories"    on public.categories    for all to authenticated using (true) with check (true);
create policy "auth write subcategories" on public.subcategories for all to authenticated using (true) with check (true);
create policy "auth write sites"         on public.sites         for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- 表级权限 (GRANT)
-- Supabase 中除 RLS 策略外，还必须授予角色表级权限，
-- 否则会报 permission denied for table xxx。
-- anon（游客）：只读；authenticated（登录用户）：读写。
-- ------------------------------------------------------------
grant select on public.categories, public.subcategories, public.sites to anon, authenticated;
grant insert, update, delete on public.categories, public.subcategories, public.sites to authenticated;

-- 兼容旧库：如存在 friend_links 遗留表则清理
drop table if exists public.friend_links cascade;

-- ------------------------------------------------------------
-- 点击计数 RPC（供前台访问链接时调用，无需更新整行权限）
-- ------------------------------------------------------------
create or replace function public.increment_click(row_id uuid)
returns void language sql security definer as $$
  update public.sites set click_count = click_count + 1 where id = row_id;
$$;

-- ------------------------------------------------------------
-- updated_at 自动更新触发器
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_sites_updated_at on public.sites;
create trigger trg_sites_updated_at
  before update on public.sites
  for each row execute function public.set_updated_at();
