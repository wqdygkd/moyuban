import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('缺少 Supabase 配置。请配置 .env（VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY）')
}

export const supabase
  = supabaseUrl && supabasePublishableKey ? createClient(supabaseUrl, supabasePublishableKey) : undefined

export function assertSupabase() {
  if (!supabase) throw new Error('Supabase 未配置')
}

// 单点断言的 from/rpc 封装，消除各 api 重复的 assertSupabase()
export const database = {
  from(table) {
    assertSupabase()
    return supabase.from(table)
  },
  rpc(name, arguments_) {
    assertSupabase()
    return supabase.rpc(name, arguments_)
  },
}
