import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category, ClearableTable, Site, Subcategory } from '@/types'
import { createClient } from '@supabase/supabase-js'

interface Database {
  public: {
    Tables: {
      categories: {
        Row: Category
        Insert: Partial<Category> & { name: string, slug: string }
        Update: Partial<Category>
        Relationships: []
      }
      subcategories: {
        Row: Subcategory
        Insert: Partial<Subcategory> & { name: string, category_id: string }
        Update: Partial<Subcategory>
        Relationships: []
      }
      sites: {
        Row: Site
        Insert: Partial<Site> & { name: string, url: string }
        Update: Partial<Site>
        Relationships: []
      }
      app_meta: {
        Row: { id: number, cat: number, sub: number, site: number, updated_at: string }
        Insert: { id?: number, cat?: number, sub?: number, site?: number, updated_at?: string }
        Update: { id?: number, cat?: number, sub?: number, site?: number, updated_at?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      increment_click: { Args: { row_id: string }, Returns: undefined }
    }
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('缺少 Supabase 配置。请配置 .env（VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY）')
}

export const supabase: SupabaseClient<Database> | undefined
  = supabaseUrl && supabasePublishableKey
    ? createClient<Database>(supabaseUrl, supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true } })
    : undefined

// 拿到非空 client：写操作与查询共用，避免每处重复判空
export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) throw new Error('Supabase 未配置')
  return supabase
}

// 全表清空哨兵：Supabase delete 必须带过滤条件，用不可能存在的 id 匹配全量
const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000'

export async function clearTables(tables: ClearableTable[]): Promise<void> {
  const database = requireSupabase()
  for (const table of tables) {
    const { error } = await database.from(table).delete().neq('id', NON_EXISTENT_ID)
    if (error) throw new Error(`清空 ${table} 失败: ${error.message}`)
  }
}
