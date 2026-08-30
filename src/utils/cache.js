const KEY = 'nav_home_cache_v1'

export function readHomeCache() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (!data || !Array.isArray(data.categories)) return
    return data
  } catch {}
}

export function writeHomeCache(payload) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...payload, _ts: Date.now() }))
  } catch {}
}

export function clearHomeCache() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}
