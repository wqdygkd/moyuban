export function getHost(raw) {
  if (!raw) return ''
  try {
    return new URL(raw.trim()).hostname
  } catch {
    return ''
  }
}

export function getFaviconSource(url = '') {
  if (url.endsWith('/favicon.svg')) return '直连 · svg'
  if (url.endsWith('/favicon.png')) return '直连 · png'
  if (url.includes('faviconsnap.com')) return 'FaviconSnap'
  if (url.includes('icon.horse')) return 'Icon Horse'
  if (url.includes('google.com/s2/favicons')) return 'Google S2'
  return '手动'
}

const faviconCache = new Map()
export function getFaviconCandidates({ url, favicon_url } = {}) {
  const key = `${url}::${favicon_url}`
  if (faviconCache.has(key)) return faviconCache.get(key)
  const list = []
  const seen = new Set()
  const push = (u) => {
    if (!u || seen.has(u)) return
    seen.add(u)
    list.push(u)
  }
  const manual = favicon_url?.trim()
  if (manual) push(manual)
  const host = getHost(url) || getHost(manual)
  if (host) {
    push(`https://${host}/favicon.svg`)
    push(`https://${host}/favicon.png`)
    push(`https://faviconsnap.com/api/favicon?url=${host}&size=128`)
    push(`https://icon.horse/icon/${host}?size=128`)
    push(`https://www.google.com/s2/favicons?domain=${host}&sz=128`)
  }
  faviconCache.set(key, list)
  return list
}
