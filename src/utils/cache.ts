import type { HomeCacheData } from '@/types'

const KEY_DATA = 'nav_home_cache_v3'
const TTL_MS = 1000 * 60 * 60 * 24 // 24h 过期，过期仍可用作兜底但后台必刷新

export interface HomeCache extends HomeCacheData {
  _ts?: number
  _expired?: boolean
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
    // 超期标记为过期（调用方可据此强制刷新），但仍返回数据以秒开
    if (data._ts && Date.now() - data._ts > TTL_MS) data._expired = true
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
