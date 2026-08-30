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
