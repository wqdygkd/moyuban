import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('缺少 Supabase 配置。请配置 .env（VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY）')
}

export const supabase
  = supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true } })
    : undefined

export function assertSupabase() {
  if (!supabase) throw new Error('Supabase 未配置')
}

export async function clearTables(tables) {
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw new Error(`清空 ${table} 失败: ${error.message}`)
  }
}
