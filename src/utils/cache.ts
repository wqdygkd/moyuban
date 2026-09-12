import type { HomeCacheData } from '@/types'

const KEY_DATA = 'nav_home_cache_v3'

export type HomeCache = HomeCacheData & {
  _ts?: number
}

function safeJsonParse(raw: string): HomeCache | undefined {
  try {
    return JSON.parse(raw) as HomeCache
  } catch {
    return undefined
  }
}

export function readHomeCache(): HomeCache | undefined {
  try {
    const raw = localStorage.getItem(KEY_DATA)
    if (!raw) return undefined
    const data = safeJsonParse(raw)
    if (!data || !Array.isArray(data.categories)) return undefined
    // _ts 仅用于诊断缓存新鲜度；过期数据仍返回以秒开，后台会对照 app_meta 版本强制刷新
    return data
  } catch {
    return undefined
  }
}

export function writeHomeCache(payload: HomeCacheData): void {
  try {
    localStorage.setItem(KEY_DATA, JSON.stringify({ ...payload, _ts: Date.now() }))
  } catch {
    // 配额满等异常直接忽略，保证主流程不受影响
  }
}

export function clearHomeCache(): void {
  try {
    localStorage.removeItem(KEY_DATA)
  } catch {
    // 忽略
  }
}
