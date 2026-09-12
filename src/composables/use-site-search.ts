import type { SiteHome } from '@/types'
import type { SiteSearchOutcome } from '@/utils/search'
import { fetchSites } from '@/services/api'
import { readHomeCache } from '@/utils/cache'
import { createSiteSearch, runSiteSearch } from '@/utils/search'

// 模块级共享：顶栏/首页/搜索页所有调用方共用同一份站点数据与 fuse 索引，
// 避免各自拉数据造成重复请求与索引重复构建。
const sites = ref<SiteHome[]>([])
const ready = ref(false)
const failed = ref(false)
// 容器对象存非响应式状态：模块级 let 在函数内赋值会触发
// unicorn/no-top-level-assignment-in-function（同 router 的 authInitState 惯例）。
// fetchedAt=上次成功拉取（TTL 门控）；attemptedAt=上次尝试（失败退避门控），两种时间语义分开。
const lifecycle: { pending?: Promise<void>, fetchedAt: number, attemptedAt: number } = {
  fetchedAt: 0,
  attemptedAt: 0,
}

// 就绪后的静默刷新间隔：首页改了数据，搜索侧最多落后 1 分钟
const REFRESH_TTL_MS = 60_000
// 拉取失败后的退避间隔：期间不发请求，避免每次键入都重试打爆
const RETRY_BACKOFF_MS = 10_000

async function load(): Promise<void> {
  // 缓存先行：不等网络就有可搜数据（fetchSites 本身只返回 is_active=true）
  if (!ready.value) {
    const cached = readHomeCache()?.sites
    if (cached?.length) sites.value = cached
  }
  const fresh = await fetchSites()
  sites.value = fresh
  lifecycle.fetchedAt = Date.now()
  ready.value = true
  failed.value = false
}

export function useSiteSearch() {
  // sites 变化（缓存秒开 → 网络刷新）自动重建索引；几百条重建在毫秒级
  const fuse = computed(() => createSiteSearch(sites.value))

  /**
  幂等触发数据加载：成功后 TTL 内复用；失败（或进行中）退避期内不发新请求
   */
  async function ensure(): Promise<void> {
    const now = Date.now()
    if (ready.value && now - lifecycle.fetchedAt < REFRESH_TTL_MS) return
    if (!lifecycle.pending && now - lifecycle.attemptedAt >= RETRY_BACKOFF_MS) {
      lifecycle.attemptedAt = now
      lifecycle.pending = (async () => {
        try {
          await load()
        } catch (error) {
          if (sites.value.length > 0) {
            // 缓存兜底可继续搜，静默降级（退避由 attemptedAt 门控）
            console.warn('[search] 后台刷新失败', error)
          } else {
            failed.value = true
          }
        } finally {
          lifecycle.pending = undefined
        }
      })()
    }
    await lifecycle.pending
  }

  function search(query: string): SiteSearchOutcome {
    return runSiteSearch(fuse.value, query)
  }

  return { sites, ready, failed, ensure, search }
}
