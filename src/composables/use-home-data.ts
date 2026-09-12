import type { AppVersion, CategoryHome, SiteHome, SubcategoryHome } from '@/types'
import type { HomeCache } from '@/utils/cache'
import { fetchCategories, fetchSites, fetchSubcategories, metaApi } from '@/services/api'
import { readHomeCache, writeHomeCache } from '@/utils/cache'

export interface LoadDataOptions { silent?: boolean, force?: boolean }

// 按表按需拉取：版本一致则跳过
function isVersionEqual(a: AppVersion | null | undefined, b: AppVersion | null | undefined): boolean {
  return !!a && !!b && a.cat === b.cat && a.sub === b.sub && a.site === b.site
}

/**
 * 首页 / 分类页共享的数据加载：
 * - setup 阶段读 localStorage 秒开（hasCache 供调用方区分首屏来源）
 * - loadData 按 app_meta 版本差量拉取（force 全量、silent 静默后台刷新）
 * - syncHomeCache 把编辑后的内存数据同步回缓存
 * onSettled 在每次 loading 结束后触发（挂载渲染 / 拖拽重建等视图侧收尾）。
 */
export function useHomeData(options: { onSettled?: () => void | Promise<void> } = {}) {
  const loading = ref(true)
  const error = ref('')
  const categories = ref<CategoryHome[]>([])
  const subcategories = ref<SubcategoryHome[]>([])
  const sites = ref<SiteHome[]>([])

  function setCache(c: HomeCache | undefined): void {
    categories.value = c?.categories || []
    subcategories.value = c?.subcategories || []
    sites.value = c?.sites || []
  }

  // setup 阶段同步读缓存秒开（首次渲染无闪烁）
  const cachedOnInit = readHomeCache()
  setCache(cachedOnInit)
  const hasCache = !!cachedOnInit
  if (hasCache) loading.value = false

  async function loadData({ silent = false, force = false }: LoadDataOptions = {}): Promise<void> {
    const cached = readHomeCache()
    const hasLocal = !!cached
    if (!silent && !hasLocal) loading.value = true
    if (!silent) error.value = ''
    try {
      let remote: AppVersion | undefined
      try {
        remote = await metaApi.getVersion()
      } catch (error_) {
        if (!hasLocal) throw error_
        console.warn('[cache] 版本探测失败', error_)
      }
      if (!force && isVersionEqual(remote, cached?.version)) return
      const v = cached?.version
      const needCats = force || !hasLocal || !remote || !v || remote.cat !== v.cat
      const needSubs = force || !hasLocal || !remote || !v || remote.sub !== v.sub
      const needSites = force || !hasLocal || !remote || !v || remote.site !== v.site
      const [cats, subs, ss] = await Promise.all([
        needCats ? fetchCategories() : Promise.resolve(cached.categories),
        needSubs ? fetchSubcategories() : Promise.resolve(cached.subcategories),
        needSites ? fetchSites() : Promise.resolve(cached.sites),
      ])
      const next = { categories: cats, subcategories: subs, sites: ss, version: remote ?? v }
      setCache(next)
      writeHomeCache(next)
    } catch (error_) {
      if (hasLocal) console.warn('[cache] 后台刷新失败', error_)
      else error.value = error_ instanceof Error ? error_.message : '加载失败，请检查 Supabase 配置'
    } finally {
      loading.value = false
      await options.onSettled?.()
    }
  }

  // 把当前内存数据同步回首页缓存（写库后 DB 触发器会自增 app_meta 版本，
  // 其余端靠版本探测自动刷新；本端直接同步保证即时可见）
  function syncHomeCache(): void {
    const version = readHomeCache()?.version
    writeHomeCache({ categories: categories.value, subcategories: subcategories.value, sites: sites.value, version })
  }

  return { loading, error, categories, subcategories, sites, hasCache, loadData, syncHomeCache }
}
