const KEY_DATA = 'nav_home_cache_v2'
const KEY_VERS = 'nav_versions_v1'

function safeJsonParse(raw) {
  try { return JSON.parse(raw) } catch { return null }
}

export function readVersions() {
  try {
    const raw = localStorage.getItem(KEY_VERS)
    if (raw) {
      const v = safeJsonParse(raw)
      if (v && typeof v.categories === 'number') return v
    }
  } catch {}
  return null
}

export function writeVersions(v) {
  try {
    if (!v) localStorage.removeItem(KEY_VERS)
    else localStorage.setItem(KEY_VERS, JSON.stringify(v))
  } catch {}
}

export function readHomeCache() {
  try {
    const raw = localStorage.getItem(KEY_DATA)
    if (raw) {
      const data = safeJsonParse(raw)
      if (data && Array.isArray(data.categories)) return data
    }
  } catch {}
  return undefined
}

export function writeHomeCache(payload) {
  try {
    const versions = payload.versions ?? readVersions()
    const toStore = { ...payload, versions, _ts: Date.now() }
    localStorage.setItem(KEY_DATA, JSON.stringify(toStore))
    if (versions) writeVersions(versions)
  } catch {}
}

export function clearHomeCache() {
  try { localStorage.removeItem(KEY_DATA) } catch {}
}

export function clearAllCache() {
  clearHomeCache()
  writeVersions(null)
}
