import type { Session, User } from '@supabase/supabase-js'

// ---------- 基础 ----------
export type ThemeName = 'douyin' | 'xhs' | 'kuaishou' | 'shipinhao'

export type ClearableTable = 'sites' | 'subcategories' | 'categories'

// 带有排序键的行：拖拽排序 / 末尾追加的最小约定
export type Orderable = {
  id: string | number
  sort_order?: string | number | null | undefined
}

// ---------- 数据库行（对齐 supabase/schema.sql） ----------
// 注意：DB 行类型必须用 type 而非 interface——supabase-js 的 GenericTable
// 要求 Row/Insert/Update 满足 Record<string, unknown>，interface 没有隐式索引签名通不过。
// （本目录统一 type 风格，见 eslint.config.js 的 files 覆盖。）
export type Category = {
  id: string
  name: string
  slug: string
  icon: string | null
  description: string | null
  sort_order: string | null
  created_at: string
}

export type Subcategory = {
  id: string
  category_id: string
  name: string
  slug: string | null
  sort_order: string | null
  created_at: string
}

export type Site = {
  id: string
  subcategory_id: string | null
  name: string
  url: string
  description: string | null
  keywords: string | null
  favicon_url: string | null
  image_url: string | null
  is_hot: boolean
  is_new: boolean
  is_featured: boolean
  click_count: number
  sort_order: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AppVersion = {
  cat: number
  sub: number
  site: number
}

// ---------- 前台瘦字段（fetchCategories/fetchSubcategories/fetchSites 返回） ----------
// description 供前台"编辑站点/分类"弹窗回显，缺字段会导致弹窗描述恒为空
export type CategoryHome = Pick<Category, 'id' | 'name' | 'slug' | 'icon' | 'description' | 'sort_order'>
export type SubcategoryHome = Pick<Subcategory, 'id' | 'category_id' | 'name' | 'slug' | 'sort_order'>
export type SiteHome = Pick<
  Site,
  'id' | 'subcategory_id' | 'name' | 'url' | 'description' | 'favicon_url' | 'image_url' | 'keywords' | 'is_active' | 'is_hot' | 'is_new' | 'is_featured' | 'sort_order' | 'created_at'
>

export type HomeCacheData = {
  categories: CategoryHome[]
  subcategories: SubcategoryHome[]
  sites: SiteHome[]
  version?: AppVersion
}

// ---------- 后台 join ----------
export type SubcategoryWithCategory = {
  category: { name: string, slug: string } | null
} & Subcategory

// ---------- 通用 CRUD ----------
export type CrudApi<TList, TRow = TList> = {
  list: () => Promise<TList[]>
  create: (payload: Partial<TRow>) => Promise<TRow>
  update: (id: string, payload: Partial<TRow>) => Promise<TRow>
  remove: (id: string) => Promise<void>
  batchRemove: (ids: string[]) => Promise<void>
}

export type ListPagedParameters = {
  page?: number
  pageSize?: number
  keyword?: string
  subcategoryIds?: string[]
}

export type PagedResult<T> = {
  data: T[]
  total: number
}

// ---------- 导入导出 ----------
export type ExportSite = {
  id: string
  name: string
  url: string
  description: string | null
  icon: string | null
  isRecommended: boolean
  views: number
  sort_order: string | null
}

export type ExportSubcategory = {
  id: string
  name: string
  code: string | null
  sort_order: string | null
  sites: ExportSite[]
}

export type ExportCategory = {
  id: string
  name: string
  code: string
  icon: string | null
  description: string | null
  sort_order: string | null
  children: ExportSubcategory[]
}

// 导入源的宽松行：JSON 手写/旧备份，字段缺失或类型混杂均允许
export type RawDumpSite = {
  name: string
  url: string
  description?: string | null
  icon?: string | null
  favicon_url?: string | null
  isRecommended?: boolean
  views?: number
  sort_order?: string | number | null
}

export type RawDumpSubcategory = {
  id?: string | number
  name: string
  code?: string | null
  sort_order?: string | number | null
  sites?: RawDumpSite[]
}

export type RawDumpCategory = {
  id?: string | number
  name: string
  code?: string | null
  icon?: string | null
  description?: string | null
  sort_order?: string | number | null
  children?: RawDumpSubcategory[]
}

export type NavDump = {
  categoryTree?: { categories?: RawDumpCategory[] }
}

export type DumpSummary = {
  categoryCount: number
  subcategoryCount: number
  siteCount: number
}

export type ImportStage = 'clear' | 'category' | 'site' | 'done'
export type ImportProgress = {
  stage: ImportStage
  current: number
  total: number
  message: string
}
export type ImportProgressHandler = (progress: ImportProgress) => void

export type ImportOptions = {
  clearFirst?: boolean
  onProgress?: ImportProgressHandler
}

export type ImportResult = {
  categories: number
  subcategories: number
  sites: number
  skipped: number
}

// ---------- 认证 ----------
export type AuthState = {
  user: User | undefined
  session: Session | undefined
  initialized: boolean
  isLoggedIn: boolean
  init: () => Promise<void>
  loginWithPassword: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export { type Session, type Subscription, type User } from '@supabase/supabase-js'
