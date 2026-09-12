import type {
  Category,
  DumpSummary,
  ExportCategory,
  ExportSite,
  ExportSubcategory,
  ImportOptions,
  ImportResult,
  NavDump,
  RawDumpCategory,
  RawDumpSite,
  RawDumpSubcategory,
  Site,
  Subcategory,
} from '@/types'
import { clearTables, requireSupabase } from '@/lib/supabase'
import { groupBy } from '@/utils/group'
import { nextKey } from '@/utils/order'

export async function exportDump(categories: Category[]): Promise<{ categoryTree: { categories: ExportCategory[] } }> {
  const database = requireSupabase()
  const [{ data: subs, error: subError }, { data: sites, error: siteError }] = await Promise.all([
    database.from('subcategories').select('*').order('sort_order', { ascending: true }),
    database.from('sites').select('*').order('sort_order', { ascending: true }),
  ])
  if (subError) throw new Error(`读取子分类失败: ${subError.message}`)
  if (siteError) throw new Error(`读取网址失败: ${siteError.message}`)

  const subRows = (subs ?? []) as Subcategory[]
  const siteRows = (sites ?? []) as Site[]
  const subsByCat = groupBy(subRows, s => s.category_id)
  const sitesBySub = groupBy(siteRows, s => s.subcategory_id)

  const tree: ExportCategory[] = categories.map(c => ({
    id: c.id,
    name: c.name,
    code: c.slug,
    icon: c.icon,
    description: c.description,
    sort_order: c.sort_order,
    children: (subsByCat.get(c.id) || []).map((s): ExportSubcategory => ({
      id: s.id,
      name: s.name,
      code: s.slug,
      sort_order: s.sort_order,
      sites: (sitesBySub.get(s.id) || []).map((site): ExportSite => ({
        id: site.id,
        name: site.name,
        url: site.url,
        description: site.description,
        icon: site.favicon_url,
        isRecommended: !!site.is_featured,
        views: site.click_count || 0,
        sort_order: site.sort_order,
      })),
    })),
  }))
  return { categoryTree: { categories: tree } }
}

export function summarizeDump(dump: NavDump): DumpSummary {
  const cats = dump?.categoryTree?.categories ?? []
  let subCount = 0
  let siteCount = 0
  for (const c of cats) {
    const children = (c.children || []) as RawDumpSubcategory[]
    subCount += children.length
    for (const s of children) siteCount += (s.sites || []).length
  }
  return { categoryCount: cats.length, subcategoryCount: subCount, siteCount }
}

// 解析并校验导入源 JSON：兼容 { categoryTree: { categories } } 与顶层 { categories }
// 两种形状；畸形数据在此给出明确错误，而不是拖到导入中途才失败
export function parseNavDump(raw: unknown): NavDump {
  if (typeof raw !== 'object' || raw === null)
    throw new Error('数据格式不正确：顶层必须是 JSON 对象')
  const object = raw as Record<string, unknown>
  const tree = (object.categoryTree ?? object) as Record<string, unknown> | undefined
  const cats = tree?.categories
  if (!Array.isArray(cats))
    throw new Error('数据格式不正确：缺少 categories 数组')
  if (cats.some(c => typeof c !== 'object' || c === null || typeof (c as { name?: unknown }).name !== 'string'))
    throw new Error('数据格式不正确：categories 中存在缺少 name 字段的条目')
  return { categoryTree: { categories: cats as RawDumpCategory[] } }
}

/**
 * 按导出时的 sort_order 排序（空键沉底；纯数字按数值比，其余按包定义的字典序）。
 * 导入时先排好序再生成新键，顺序即原展示序，且合库时不会与现存键冲突。
 */
function bySortKey(a: { sort_order?: string | number | null }, b: { sort_order?: string | number | null }): number {
  const ka = a.sort_order ?? ''
  const kb = b.sort_order ?? ''
  if (ka === kb) return 0
  if (ka === '') return 1
  if (kb === '') return -1
  if (typeof ka === 'number' && typeof kb === 'number') return ka - kb
  const sa = String(ka)
  const sb = String(kb)
  if (sa < sb) return -1
  return 1
}

interface NormalizedSite {
  name: string
  url: string
  description?: string | null
  icon?: string | null
  subcategorySlug: string
  isRecommended: boolean
  views: number
}

interface NormalizedSubcategory {
  origId: string | number | undefined
  name: string
  slug: string
  sort_order?: string | number | null
  sites: RawDumpSite[]
}

interface NormalizedCategory {
  origId: string | number | undefined
  name: string
  slug: string
  icon: string
  sort_order?: string | number | null
  children: NormalizedSubcategory[]
}

function normalize(dump: NavDump): { categories: NormalizedCategory[], sites: NormalizedSite[] } {
  const rawTree = dump?.categoryTree?.categories
  if (!Array.isArray(rawTree))
    throw new Error('数据格式不正确：缺少 categories')
  const raw: RawDumpCategory[] = rawTree
  const categories: NormalizedCategory[] = raw.map((c, categoryIndex) => ({
    origId: c.id,
    name: c.name,
    slug: c.code || `cat-${categoryIndex + 1}`,
    icon: c.icon || c.name?.[0] || '',
    sort_order: c.sort_order,
    children: (c.children || []).map((s, subcategoryIndex) => ({
      origId: s.id,
      name: s.name,
      slug: s.code || `sub-${categoryIndex + 1}-${subcategoryIndex + 1}`,
      sort_order: s.sort_order,
      sites: (s.sites || []).toSorted(bySortKey),
    })).toSorted(bySortKey),
  })).toSorted(bySortKey)

  const sites: NormalizedSite[] = []
  for (const category of categories) {
    for (const subcategory of category.children) {
      for (const site of subcategory.sites) {
        sites.push({ name: site.name, url: site.url, description: site.description, icon: site.icon || site.favicon_url, subcategorySlug: subcategory.slug, isRecommended: !!site.isRecommended, views: site.views || 0 })
      }
    }
  }
  return { categories, sites }
}

export async function importDump(dump: NavDump, { clearFirst = false, onProgress = () => {} }: ImportOptions = {}): Promise<ImportResult> {
  const database = requireSupabase()
  const { categories, sites } = normalize(dump)

  if (clearFirst) {
    onProgress({ stage: 'clear', current: 0, total: 0, message: '正在清空旧数据...' })
    await clearTables(['sites', 'subcategories', 'categories'])
  }

  onProgress({ stage: 'category', current: 0, total: categories.length, message: '正在导入分类...' })
  const catIdMap = new Map<string, string>()
  let lastCatKey: string | null | undefined
  for (const [categoryIndex, category] of categories.entries()) {
    lastCatKey = nextKey(lastCatKey)
    const { data, error } = await database.from('categories').insert({ name: category.name, slug: category.slug, icon: category.icon, sort_order: lastCatKey }).select('id').single()
    if (error || !data)
      throw new Error(`导入分类「${category.name}」失败: ${error?.message ?? '未知错误'}`)
    catIdMap.set(String(category.origId ?? categoryIndex), data.id)
    onProgress({ stage: 'category', current: categoryIndex + 1, total: categories.length, message: `已导入分类：${category.name}` })
  }

  const subsBySlug = new Map<string, { id: string, slug: string }>() // slug -> {id}；跨分类重名 slug 只保留第一组（导出顺序），
  // 后续同名组的网址并入第一组——按 slug 本来就无法区分归属，确定性合并优于静默覆盖到最后一组
  let lastSubKey: string | null | undefined
  for (const [categoryIndex, category] of categories.entries()) {
    const parentId = catIdMap.get(String(category.origId ?? categoryIndex))
    if (!parentId) throw new Error(`导入子分类失败：找不到「${category.name}」的主分类`)
    for (const subcategory of category.children) {
      lastSubKey = nextKey(lastSubKey)
      const { data, error } = await database.from('subcategories').insert({ category_id: parentId, name: subcategory.name, slug: subcategory.slug, sort_order: lastSubKey }).select('id').single()
      if (error || !data)
        throw new Error(`导入子分类「${subcategory.name}」失败: ${error?.message ?? '未知错误'}`)
      if (!subsBySlug.has(subcategory.slug)) subsBySlug.set(subcategory.slug, { id: data.id, slug: subcategory.slug })
    }
  }

  onProgress({ stage: 'site', current: 0, total: sites.length, message: '正在导入网址...' })
  let inserted = 0
  let skipped = 0
  // 批量插入（每批 100 条，10x 往返缩减）
  const BATCH = 100
  const rows: Array<Partial<Site> & { subcategory_id: string, name: string, url: string, sort_order: string }> = []
  let lastSiteKey: string | null | undefined
  for (const site of sites) {
    const sub = subsBySlug.get(site.subcategorySlug)
    if (!sub) {
      skipped++
      continue
    }
    lastSiteKey = nextKey(lastSiteKey)
    rows.push({
      subcategory_id: sub.id,
      name: site.name,
      url: site.url,
      description: site.description,
      favicon_url: site.icon || undefined,
      is_featured: site.isRecommended,
      is_hot: site.isRecommended,
      is_new: false,
      click_count: site.views || 0,
      sort_order: lastSiteKey,
    })
  }
  for (let index = 0; index < rows.length; index += BATCH) {
    const batch = rows.slice(index, index + BATCH)
    const { error } = await database.from('sites').insert(batch as never)
    if (error) throw new Error(`批量导入网址失败 (${index + 1}~${index + batch.length}): ${error.message}`)
    inserted += batch.length
    onProgress({ stage: 'site', current: Math.min(index + BATCH, rows.length), total: rows.length, message: `已导入 ${inserted}/${rows.length} 个网址` })
  }
  onProgress({ stage: 'done', current: inserted, total: sites.length, message: `导入完成：分类 ${categories.length}，子分类 ${subsBySlug.size}，网址 ${inserted}（跳过 ${skipped}）` })
  return { categories: categories.length, subcategories: subsBySlug.size, sites: inserted, skipped }
}
