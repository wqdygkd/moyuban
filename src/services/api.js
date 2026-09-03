import { database } from '@/lib/supabase'

function makeCrud(table) {
  return {
    async list(select = '*') {
      const { data, error } = await database.from(table).select(select).order('sort_order', { ascending: true })
      if (error) throw error
      return data
    },
    async create(payload) {
      const { data, error } = await database.from(table).insert(payload).select().single()
      if (error) throw error
      return data
    },
    async update(id, payload) {
      const { data, error } = await database.from(table).update(payload).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    async remove(id) {
      const { error } = await database.from(table).delete().eq('id', id)
      if (error) throw error
    },
    async batchRemove(ids) {
      const { error } = await database.from(table).delete().in('id', ids)
      if (error) throw error
    },
  }
}

export const categoryApi = makeCrud('categories')

export const subcategoryApi = {
  ...makeCrud('subcategories'),
  // 覆盖 list 以带上所属分类信息
  async list() {
    const { data, error } = await database.from('subcategories').select('*, category:categories(name, slug)').order('sort_order', { ascending: true })
    if (error) throw error
    return data
  },
}

export const siteApi = {
  ...makeCrud('sites'),
  async listFeatured() {
    const { data, error } = await database.from('sites').select('*').eq('is_featured', true).order('sort_order', { ascending: true })
    if (error) throw error
    return data
  },
  async incrementClick(id) {
    await database.rpc('increment_click', { row_id: id })
  },
}

// 单行三版本探测（短列名 cat/sub/site，~30B），按表按需拉取
export const metaApi = {
  async getVersions() {
    const { data, error } = await database.from('app_meta').select('cat, sub, site').eq('id', 1).single()
    if (error) throw error
    return data
  },
}

// 前台首页专用瘦字段
const SITE_HOME_FIELDS = 'id,subcategory_id,name,url,description,favicon_url,is_hot,is_new,is_featured,sort_order'
const CAT_HOME_FIELDS = 'id,name,slug,icon,sort_order'
const SUB_HOME_FIELDS = 'id,category_id,name,slug,sort_order'

export async function fetchCategories() {
  const { data, error } = await database.from('categories').select(CAT_HOME_FIELDS).order('sort_order', { ascending: true })
  if (error) throw error
  return data
}
export async function fetchSubcategories() {
  const { data, error } = await database.from('subcategories').select(SUB_HOME_FIELDS).order('sort_order', { ascending: true })
  if (error) throw error
  return data
}
export async function fetchSites() {
  const { data, error } = await database.from('sites').select(SITE_HOME_FIELDS).eq('is_active', true).order('sort_order', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchHomeData() {
  const [catsRes, subsRes, sitesRes] = await Promise.all([
    database.from('categories').select(CAT_HOME_FIELDS).order('sort_order', { ascending: true }),
    database.from('subcategories').select(SUB_HOME_FIELDS).order('sort_order', { ascending: true }),
    database.from('sites').select(SITE_HOME_FIELDS).eq('is_active', true).order('sort_order', { ascending: true }),
  ])
  if (catsRes.error) throw catsRes.error
  if (subsRes.error) throw subsRes.error
  if (sitesRes.error) throw sitesRes.error
  const featured = sitesRes.data.filter(s => s.is_featured)
  return { categories: catsRes.data, subcategories: subsRes.data, sites: sitesRes.data, featured }
}
