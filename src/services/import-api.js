import { BASE_62_DIGITS, generateKeyBetween } from 'fractional-indexing'
import { assertSupabase, clearTables, supabase } from '@/lib/supabase'

export async function exportDump(categories) {
  assertSupabase()
  const [{ data: subs, error: subError }, { data: sites, error: siteError }] = await Promise.all([
    supabase.from('subcategories').select('*').order('sort_order', { ascending: true }),
    supabase.from('sites').select('*').order('sort_order', { ascending: true }),
  ])
  if (subError) throw new Error(`读取子分类失败: ${subError.message}`)
  if (siteError) throw new Error(`读取网址失败: ${siteError.message}`)

  const subsByCat = new Map()
  for (const s of subs) {
    const a = subsByCat.get(s.category_id)
    if (a) a.push(s)
    else subsByCat.set(s.category_id, [s])
  }
  const sitesBySub = new Map()
  for (const s of sites) {
    const a = sitesBySub.get(s.subcategory_id)
    if (a) a.push(s)
    else sitesBySub.set(s.subcategory_id, [s])
  }

  const tree = categories.map(c => ({
    id: c.id,
    name: c.name,
    code: c.slug,
    icon: c.icon,
    description: c.description,
    sort_order: c.sort_order,
    children: (subsByCat.get(c.id) || []).map(s => ({
      id: s.id,
      name: s.name,
      code: s.slug,
      sort_order: s.sort_order,
      sites: (sitesBySub.get(s.id) || []).map(site => ({
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

export function summarizeDump(dump) {
  const cats = dump?.categoryTree?.categories || []
  let subCount = 0
  let siteCount = 0
  for (const c of cats) {
    const children = c.children || []
    subCount += children.length
    for (const s of children) siteCount += (s.sites || []).length
  }
  return { categoryCount: cats.length, subcategoryCount: subCount, siteCount }
}

/**
 * 按导出时的 sort_order 排序（空键沉底；纯数字按数值比，其余按包定义的字典序）。
 * 导入时先排好序再生成新键，顺序即原展示序，且合库时不会与现存键冲突。
 */
function bySortKey(a, b) {
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

function normalize(dump) {
  const rawTree = dump?.categoryTree?.categories
  if (!Array.isArray(rawTree))
    throw new Error('数据格式不正确：缺少 categories')
  const categories = rawTree.map((c, categoryIndex) => ({
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

  const sites = []
  for (const category of categories) {
    for (const subcategory of category.children) {
      for (const site of subcategory.sites) {
        sites.push({ name: site.name, url: site.url, description: site.description, icon: site.icon || site.favicon_url, categoryCode: subcategory.slug, isRecommended: !!site.isRecommended, views: site.views || 0 })
      }
    }
  }
  return { categories, sites }
}

export async function importDump(dump, { clearFirst = false, onProgress = () => {} } = {}) {
  assertSupabase()
  const { categories, sites } = normalize(dump)

  if (clearFirst) {
    onProgress('clear', 0, 0, '正在清空旧数据...')
    await clearTables(['sites', 'subcategories', 'categories'])
  }

  onProgress('category', 0, categories.length, '正在导入分类...')
  const catIdMap = new Map()
  let lastCatKey
  for (const [categoryIndex, category] of categories.entries()) {
    lastCatKey = generateKeyBetween(lastCatKey, undefined, BASE_62_DIGITS)
    const { data, error } = await supabase.from('categories').insert({ name: category.name, slug: category.slug, icon: category.icon, sort_order: lastCatKey }).select('id').single()
    if (error)
      throw new Error(`导入分类「${category.name}」失败: ${error.message}`)
    catIdMap.set(String(category.origId ?? categoryIndex), data.id)
    onProgress('category', categoryIndex + 1, categories.length, `已导入分类：${category.name}`)
  }

  const subsBySlug = new Map() // slug -> {id}；跨分类重名 slug 只保留第一组（导出顺序），
  // 后续同名组的网址并入第一组——按 slug 本来就无法区分归属，确定性合并优于静默覆盖到最后一组
  let lastSubKey
  for (const [categoryIndex, category] of categories.entries()) {
    const parentId = catIdMap.get(String(category.origId ?? categoryIndex))
    for (const subcategory of category.children) {
      lastSubKey = generateKeyBetween(lastSubKey, undefined, BASE_62_DIGITS)
      const { data, error } = await supabase.from('subcategories').insert({ category_id: parentId, name: subcategory.name, slug: subcategory.slug, sort_order: lastSubKey }).select('id').single()
      if (error)
        throw new Error(`导入子分类「${subcategory.name}」失败: ${error.message}`)
      if (!subsBySlug.has(subcategory.slug)) subsBySlug.set(subcategory.slug, { id: data.id, slug: subcategory.slug })
    }
  }

  onProgress('site', 0, sites.length, '正在导入网址...')
  let inserted = 0
  let skipped = 0
  // 批量插入（每批 100 条，10x 往返缩减）
  const BATCH = 100
  const rows = []
  let lastSiteKey
  for (const site of sites) {
    const sub = subsBySlug.get(site.categoryCode)
    if (!sub) {
      skipped++
      continue
    }
    lastSiteKey = generateKeyBetween(lastSiteKey, undefined, BASE_62_DIGITS)
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
    const { error } = await supabase.from('sites').insert(batch)
    if (error) throw new Error(`批量导入网址失败 (${index + 1}~${index + batch.length}): ${error.message}`)
    inserted += batch.length
    onProgress('site', Math.min(index + BATCH, rows.length), rows.length, `已导入 ${inserted}/${rows.length} 个网址`)
  }
  onProgress('done', inserted, sites.length, `导入完成：分类 ${categories.length}，子分类 ${subsBySlug.size}，网址 ${inserted}（跳过 ${skipped}）`)
  return { categories: categories.length, subcategories: subsBySlug.size, sites: inserted, skipped }
}
