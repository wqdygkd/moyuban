import type { PostgrestError } from '@supabase/supabase-js'
import type {
  AppVersion,
  Category,
  CategoryHome,
  CrudApi,
  ListPagedParameters,
  PagedResult,
  Site,
  SiteHome,
  Subcategory,
  SubcategoryHome,
  SubcategoryWithCategory,
} from '@/types'
import { requireSupabase } from '@/lib/supabase'
import { appendOrderKey } from '@/utils/order'

// 写操作前确认本地仍有 session，避免以游客(anon)身份发请求
// （此时 PostgREST 会报极具误导性的 "GRANT ... TO anon"，切勿照做给 anon 开写权限）。
async function requireSession(action = '保存'): Promise<void> {
  const database = requireSupabase()
  const { data } = await database.auth.getSession()
  if (!data.session)
    throw new Error(`${action}失败：登录已过期或未登录，请重新登录后再试。`)
}

// 有 session 仍 42501，说明线上库表级权限/策略缺失，修库而不是给 anon 放权。
function friendlyWriteError(originalError: PostgrestError | Error, action = '保存'): Error {
  const message = originalError?.message || ''
  const code = (originalError as PostgrestError)?.code
  if (code === 'PGRST301' || /jwt expired|invalid jwt/i.test(message))
    return new Error(`${action}失败：登录已过期，请重新登录后再试。`)
  if (code === '42501' || /permission denied/i.test(message))
    return new Error(`${action}失败：数据库拒绝写入（表权限缺失）。请在 Supabase SQL Editor 重新执行 supabase/schema.sql 后重试。`)
  return originalError instanceof Error ? originalError : new Error(message)
}

async function withSession<T>(action: string, run: () => Promise<T>): Promise<T> {
  await requireSession(action)
  try {
    return await run()
  } catch (error) {
    throw friendlyWriteError(error as PostgrestError | Error, action)
  }
}

function createCrudApi<TList extends { id: string }, TRow extends { id: string } = TList>(table: 'categories' | 'subcategories' | 'sites'): CrudApi<TList, TRow> {
  const database = requireSupabase()
  return {
    async list(select = '*'): Promise<TList[]> {
      const { data, error } = await database.from(table).select(select).order('sort_order', { ascending: true })
      if (error) throw error
      return data as unknown as TList[]
    },
    async create(payload: Partial<TRow>): Promise<TRow> {
      return withSession('新增', async () => {
        const { data, error } = await database.from(table).insert(payload as never).select().single()
        if (error) throw error
        return data as unknown as TRow
      })
    },
    async update(id: string, payload: Partial<TRow>): Promise<TRow> {
      return withSession('保存', async () => {
        const { data, error } = await database.from(table).update(payload as never).eq('id', id).select().single()
        if (error) throw error
        return data as unknown as TRow
      })
    },
    async remove(id: string): Promise<void> {
      return withSession('删除', async () => {
        const { error } = await database.from(table).delete().eq('id', id)
        if (error) throw error
      })
    },
    async batchRemove(ids: string[]): Promise<void> {
      return withSession('删除', async () => {
        const { error } = await database.from(table).delete().in('id', ids)
        if (error) throw error
      })
    },
  }
}

export const categoryApi: CrudApi<Category, Category> = createCrudApi<Category>('categories')

export const subcategoryApi: CrudApi<SubcategoryWithCategory, Subcategory> = {
  ...createCrudApi<SubcategoryWithCategory, Subcategory>('subcategories'),
  async list(): Promise<SubcategoryWithCategory[]> {
    const database = requireSupabase()
    const { data, error } = await database.from('subcategories').select('*, category:categories(name, slug)').order('sort_order', { ascending: true })
    if (error) throw error
    return data as unknown as SubcategoryWithCategory[]
  },
}

export const siteApi = {
  ...createCrudApi<Site>('sites'),
  async listPaged({ page = 1, pageSize = 10, keyword = '', subcategoryIds }: ListPagedParameters = {}): Promise<PagedResult<Site>> {
    if (subcategoryIds?.length === 0) return { data: [], total: 0 }
    const database = requireSupabase()
    let query = database.from('sites').select('*', { count: 'exact' }).order('sort_order', { ascending: true })
    if (keyword) {
      const k = `%${keyword.replaceAll(/[%\\]/g, '').trim()}%`
      query = query.or(`name.ilike.${k},url.ilike.${k},description.ilike.${k}`)
    }
    if (subcategoryIds?.length) query = query.in('subcategory_id', subcategoryIds)
    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)
    const { data, error, count } = await query
    if (error) throw error
    return { data: data as Site[], total: count ?? 0 }
  },
  async endKeyForSub(subcategoryId: string): Promise<string> {
    const database = requireSupabase()
    const { data, error } = await database.from('sites').select('sort_order').eq('subcategory_id', subcategoryId)
    if (error) throw error
    return appendOrderKey((data ?? []) as Array<{ sort_order: string | null }>, r => r.sort_order)
  },
  async incrementClick(id: string): Promise<void> {
    const database = requireSupabase()
    await database.rpc('increment_click', { row_id: id })
  },
}

// 单次探测三版本（~30B），按表按需拉取
export const metaApi = {
  async getVersion(): Promise<AppVersion> {
    const database = requireSupabase()
    const { data, error } = await database.from('app_meta').select('cat, sub, site').eq('id', 1).single()
    if (error) throw error
    return data as AppVersion
  },
}

// 前台首页专用瘦字段
const SITE_HOME_FIELDS = 'id,subcategory_id,name,url,description,favicon_url,is_hot,is_new,is_featured,sort_order,created_at'
const CAT_HOME_FIELDS = 'id,name,slug,icon,sort_order'
const SUB_HOME_FIELDS = 'id,category_id,name,slug,sort_order'

export async function fetchCategories(): Promise<CategoryHome[]> {
  const database = requireSupabase()
  const { data, error } = await database.from('categories').select(CAT_HOME_FIELDS).order('sort_order', { ascending: true })
  if (error) throw error
  return data as unknown as CategoryHome[]
}
export async function fetchSubcategories(): Promise<SubcategoryHome[]> {
  const database = requireSupabase()
  const { data, error } = await database.from('subcategories').select(SUB_HOME_FIELDS).order('sort_order', { ascending: true })
  if (error) throw error
  return data as unknown as SubcategoryHome[]
}
export async function fetchSites(): Promise<SiteHome[]> {
  const database = requireSupabase()
  const { data, error } = await database.from('sites').select(SITE_HOME_FIELDS).eq('is_active', true).order('sort_order', { ascending: true })
  if (error) throw error
  return data as unknown as SiteHome[]
}
