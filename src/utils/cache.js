const KEY_DATA = 'nav_home_cache_v3'
const TTL_MS = 1000 * 60 * 60 * 24 // 24h 过期，过期仍可用作兜底但后台必刷新

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {}
}

export function readHomeCache() {
  try {
    const raw = localStorage.getItem(KEY_DATA)
    if (!raw) return
    const data = safeJsonParse(raw)
    if (!data || !Array.isArray(data.categories)) return
    // 超期标记为过期（调用方可据此强制刷新），但仍返回数据以秒开
    if (data._ts && Date.now() - data._ts > TTL_MS) data._expired = true
    return data
  } catch {}
}

export function writeHomeCache(payload) {
  try {
    localStorage.setItem(KEY_DATA, JSON.stringify({ ...payload, _ts: Date.now() }))
  } catch {}
}

export function clearHomeCache() {
  try {
    localStorage.removeItem(KEY_DATA)
  } catch {}
}
