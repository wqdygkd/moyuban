export function getHost(raw: string | null | undefined): string {
  if (!raw) return ''
  try {
    return new URL(raw.trim()).hostname
  } catch {
    return ''
  }
}

export function getFaviconSource(url = ''): string {
  if (url.endsWith('/favicon.svg')) return '直连 · svg'
  if (url.endsWith('/favicon.png')) return '直连 · png'
  if (url.includes('faviconsnap.com')) return 'FaviconSnap'
  if (url.includes('icon.horse')) return 'Icon Horse'
  return '手动'
}

export interface FaviconTarget {
  url?: string | null
  favicon_url?: string | null
}

const faviconCache = new Map<string, string[]>()
// 候选顺序：favicon_url（手动）> extra（调用方补充，如 image_url）> 第三方服务，全部去重
export function getFaviconCandidates({ url, favicon_url }: FaviconTarget = {}, extra: Array<string | null | undefined> = []): string[] {
  const key = `${url}::${favicon_url}::${extra.join('|')}`
  const hit = faviconCache.get(key)
  if (hit) return hit
  const list: string[] = []
  const seen = new Set<string>()
  const push = (u: string | null | undefined) => {
    if (!u || seen.has(u)) return
    seen.add(u)
    list.push(u)
  }
  const manual = favicon_url?.trim()
  if (manual) push(manual)
  for (const u of extra) push(u?.trim())
  const host = getHost(url) || getHost(manual)
  if (host) {
    push(`https://faviconsnap.com/api/favicon?url=${host}&size=128`)
    push(`https://icon.horse/icon/${host}?size=128`)
  }
  faviconCache.set(key, list)
  return list
}
