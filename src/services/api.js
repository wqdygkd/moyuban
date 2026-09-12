import { assertSupabase, supabase } from '@/lib/supabase'
import { appendOrderKey } from '@/utils/order'

// 写操作前确认本地仍有 session，避免以游客(anon)身份发请求
// （此时 PostgREST 会报极具误导性的 "GRANT ... TO anon"，切勿照做给 anon 开写权限）。
async function requireSession(action = '保存') {
  assertSupabase()
  const { data } = await supabase.auth.getSession()
  if (!data.session)
    throw new Error(`${action}失败：登录已过期或未登录，请重新登录后再试。`)
}

// 有 session 仍 42501，说明线上库表级权限/策略缺失，修库而不是给 anon 放权。
function friendlyWriteError(originalError, action = '保存') {
  const message = originalError?.message || ''
  if (originalError?.code === 'PGRST301' || /jwt expired|invalid jwt/i.test(message))
    return new Error(`${action}失败：登录已过期，请重新登录后再试。`)
  if (originalError?.code === '42501' || /permission denied/i.test(message))
    return new Error(`${action}失败：数据库拒绝写入（表权限缺失）。请在 Supabase SQL Editor 重新执行 supabase/schema.sql 后重试。`)
  return originalError
}

async function withSession(action, run) {
  await requireSession(action)
  try {
    return await run()
  } catch (error) {
    throw friendlyWriteError(error, action)
  }
}

function createCrudApi(table, { orderBy = 'sort_order' } = {}) {
  return {
    async list(select = '*') {
      assertSupabase()
      const { data, error } = await supabase.from(table).select(select).order(orderBy, { ascending: true })
      if (error) throw error
      return data
    },
    async create(payload) {
      return withSession('新增', async () => {
        const { data, error } = await supabase.from(table).insert(payload).select().single()
        if (error) throw error
        return data
      })
    },
    async update(id, payload) {
      return withSession('保存', async () => {
        const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single()
        if (error) throw error
        return data
      })
    },
    async remove(id) {
      return withSession('删除', async () => {
        const { error } = await supabase.from(table).delete().eq('id', id)
        if (error) throw error
      })
    },
    async batchRemove(ids) {
      return withSession('删除', async () => {
        const { error } = await supabase.from(table).delete().in('id', ids)
        if (error) throw error
      })
    },
  }
}

export const categoryApi = createCrudApi('categories')

export const subcategoryApi = {
  ...createCrudApi('subcategories'),
  async list() {
    assertSupabase()
    const { data, error } = await supabase.from('subcategories').select('*, category:categories(name, slug)').order('sort_order', { ascending: true })
    if (error) throw error
    return data
  },
}

export const siteApi = {
  ...createCrudApi('sites'),
  async listPaged({ page = 1, pageSize = 10, keyword = '', subcategoryIds } = {}) {
    assertSupabase()
    if (subcategoryIds?.length === 0) return { data: [], total: 0 }
    let query = supabase.from('sites').select('*', { count: 'exact' }).order('sort_order', { ascending: true })
    if (keyword) {
      const k = `%${keyword.replaceAll(/[%\\]/g, '').trim()}%`
      query = query.or(`name.ilike.${k},url.ilike.${k},description.ilike.${k}`)
    }
    if (subcategoryIds?.length) query = query.in('subcategory_id', subcategoryIds)
    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)
    const { data, error, count } = await query
    if (error) throw error
    return { data, total: count ?? 0 }
  },
  async endKeyForSub(subcategoryId) {
    assertSupabase()
    const { data, error } = await supabase.from('sites').select('sort_order').eq('subcategory_id', subcategoryId)
    if (error) throw error
    return appendOrderKey(data || [], r => r.sort_order)
  },
  async incrementClick(id) {
    assertSupabase()
    await supabase.rpc('increment_click', { row_id: id })
  },
}

// 单次探测三版本（~30B），按表按需拉取
export const metaApi = {
  async getVersion() {
    assertSupabase()
    const { data, error } = await supabase.from('app_meta').select('cat, sub, site').eq('id', 1).single()
    if (error) throw error
    return data
  },
}

// 前台首页专用瘦字段
const SITE_HOME_FIELDS = 'id,subcategory_id,name,url,description,favicon_url,is_hot,is_new,is_featured,sort_order,created_at'
const CAT_HOME_FIELDS = 'id,name,slug,icon,sort_order'
const SUB_HOME_FIELDS = 'id,category_id,name,slug,sort_order'

export async function fetchCategories() {
  assertSupabase()
  const { data, error } = await supabase.from('categories').select(CAT_HOME_FIELDS).order('sort_order', { ascending: true })
  if (error) throw error
  return data
}
export async function fetchSubcategories() {
  assertSupabase()
  const { data, error } = await supabase.from('subcategories').select(SUB_HOME_FIELDS).order('sort_order', { ascending: true })
  if (error) throw error
  return data
}
export async function fetchSites() {
  assertSupabase()
  const { data, error } = await supabase.from('sites').select(SITE_HOME_FIELDS).eq('is_active', true).order('sort_order', { ascending: true })
  if (error) throw error
  return data
}
