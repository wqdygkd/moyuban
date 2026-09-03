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
drop policy if exists "public read categories" on public.categories;
create policy "public read categories"    on public.categories    for select using (true);
drop policy if exists "public read subcategories" on public.subcategories;
create policy "public read subcategories" on public.subcategories for select using (true);
drop policy if exists "public read sites" on public.sites;
create policy "public read sites"         on public.sites         for select using (true);

-- 仅登录用户可写
drop policy if exists "auth write categories" on public.categories;
create policy "auth write categories"    on public.categories    for all to authenticated using (true) with check (true);
drop policy if exists "auth write subcategories" on public.subcategories;
create policy "auth write subcategories" on public.subcategories for all to authenticated using (true) with check (true);
drop policy if exists "auth write sites" on public.sites;
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

-- ------------------------------------------------------------
-- 数据版本号 app_meta（前台缓存脏检查）
-- 单行 id=1，三列独立短列名：cat/sub/site，前台一次查三版本，按表按需拉取
-- 列名精简以进一步减少响应大小（~35B vs ~80B）
-- ------------------------------------------------------------
create table if not exists public.app_meta (
  id          int primary key,
  cat         bigint not null default 1,
  sub         bigint not null default 1,
  site        bigint not null default 1,
  updated_at  timestamptz not null default now()
);
insert into public.app_meta(id, cat, sub, site) values (1, 1, 1, 1) on conflict (id) do nothing;

alter table public.app_meta enable row level security;
drop policy if exists "public read app_meta" on public.app_meta;
create policy "public read app_meta" on public.app_meta for select using (true);
grant select on public.app_meta to anon, authenticated;

create or replace function public.bump_categories_version()
returns trigger language plpgsql as $$
begin
  update public.app_meta set cat = cat + 1, updated_at = now() where id = 1;
  return null;
end $$;
create or replace function public.bump_subcategories_version()
returns trigger language plpgsql as $$
begin
  update public.app_meta set sub = sub + 1, updated_at = now() where id = 1;
  return null;
end $$;
create or replace function public.bump_sites_version()
returns trigger language plpgsql as $$
begin
  update public.app_meta set site = site + 1, updated_at = now() where id = 1;
  return null;
end $$;

drop trigger if exists trg_bump_on_categories on public.categories;
create trigger trg_bump_on_categories after insert or update or delete on public.categories
  for each statement execute function public.bump_categories_version();
drop trigger if exists trg_bump_on_subcategories on public.subcategories;
create trigger trg_bump_on_subcategories after insert or update or delete on public.subcategories
  for each statement execute function public.bump_subcategories_version();
drop trigger if exists trg_bump_on_sites on public.sites;
-- 仅维护字段变更才 bump，click_count/updated_at 不触发以免每次点击都致缓存失效
create trigger trg_bump_on_sites after insert or delete on public.sites
  for each statement execute function public.bump_sites_version();
drop trigger if exists trg_bump_on_sites_upd on public.sites;
create trigger trg_bump_on_sites_upd after update of subcategory_id, name, url, description, favicon_url, image_url, is_hot, is_new, is_featured, sort_order, is_active on public.sites
  for each statement execute function public.bump_sites_version();

-- ------------------------------------------------------------
-- Realtime（Q5 零轮询）：发布三表以支持 postgres_changes 推送
-- ------------------------------------------------------------
-- alter table public.categories replica identity full;
-- alter table public.subcategories replica identity full;
-- alter table public.sites replica identity full;
-- do $$ begin
--   begin
--     alter publication supabase_realtime add table public.categories;
--   exception when duplicate_object then null;
--   end;
--   begin
--     alter publication supabase_realtime add table public.subcategories;
--   exception when duplicate_object then null;
--   end;
--   begin
--     alter publication supabase_realtime add table public.sites;
--   exception when duplicate_object then null;
--   end;
-- end $$;
