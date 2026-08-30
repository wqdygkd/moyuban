import { database } from '@/lib/supabase'

export async function exportDump(categories) {
  const [{ data: subs, error: subError }, { data: sites, error: siteError }] = await Promise.all([
    database.from('subcategories').select('*').order('sort_order', { ascending: true }),
    database.from('sites').select('*').order('sort_order', { ascending: true }),
  ])
  if (subError) throw new Error(`读取子分类失败: ${subError.message}`)
  if (siteError) throw new Error(`读取网址失败: ${siteError.message}`)

  const subsByCat = Map.groupBy(subs, s => s.category_id)
  const sitesBySub = Map.groupBy(sites, s => s.subcategory_id)

  const tree = categories.map(c => ({
    id: c.id,
    name: c.name,
    code: c.slug,
    icon: c.icon,
    description: c.description,
    children: (subsByCat.get(c.id) || []).map(s => ({
      id: s.id,
      name: s.name,
      code: s.slug,
      sites: (sitesBySub.get(s.id) || []).map(site => ({
        id: site.id,
        name: site.name,
        url: site.url,
        description: site.description,
        icon: site.favicon_url,
        isRecommended: !!site.is_featured,
        views: site.click_count || 0,
      })),
    })),
  }))
  return { categoryTree: { categories: tree } }
}

export function summarizeDump(dump) {
  const cats = dump?.categoryTree?.categories || dump?.categories || []
  let subCount = 0
  let siteCount = 0
  if (Array.isArray(dump?.sites)) {
    siteCount = dump.sites.length
  }
  else {
    const categoryList = cats
    for (const category of categoryList) {
      const children = category.children || category.subcategories || []
      for (const subcategory of children) siteCount += (subcategory.sites || []).length
    }
  }
  const categoryList2 = cats
  for (const category of categoryList2) subCount += (category.children || category.subcategories || []).length
  return { categoryCount: cats.length, subcategoryCount: subCount, siteCount }
}

function normalize(dump) {
  const rawTree = dump?.categoryTree?.categories || dump?.categories
  if (!Array.isArray(rawTree))
    throw new Error('数据格式不正确：缺少 categories')
  const categories = rawTree.map((c, categoryIndex) => ({
    origId: c.id,
    name: c.name,
    slug: c.code || c.slug || `cat-${categoryIndex + 1}`,
    icon: c.icon || c.name?.[0] || '',
    children: (c.children || c.subcategories || []).map((s, subcategoryIndex) => ({
      origId: s.id,
      name: s.name,
      slug: s.code || s.slug || `sub-${categoryIndex + 1}-${subcategoryIndex + 1}`,
      sites: s.sites || [],
    })),
  }))

  // 网址统一从子分类内嵌 sites 提取；兼容扁平 dump?.sites
  let sites = []
  if (Array.isArray(dump?.sites)) {
    sites = dump.sites.map(s => ({
      name: s.name,
      url: s.url,
      description: s.description,
      icon: s.icon || s.favicon_url,
      categoryCode: s?.category?.code || s?.category_code,
      isRecommended: !!s.isRecommended,
      views: s.views || 0,
    }))
  }
  else {
    for (const category of categories) {
      for (const subcategory of category.children) {
        for (const site of subcategory.sites) {
          sites.push({ name: site.name, url: site.url, description: site.description, icon: site.icon || site.favicon_url, categoryCode: subcategory.slug, isRecommended: !!site.isRecommended, views: site.views || 0 })
        }
      }
    }
  }
  return { categories, sites }
}

export async function importDump(dump, { clearFirst = false, onProgress = () => {} } = {}) {
  const { categories, sites } = normalize(dump)

  if (clearFirst) {
    const tables = ['sites', 'subcategories', 'categories']
    for (const table of tables) {
      onProgress('clear', 0, 0, `正在清空 ${table} ...`)
      const { error } = await database.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (error)
        throw new Error(`清空 ${table} 失败: ${error.message}`)
    }
  }

  onProgress('category', 0, categories.length, '正在导入分类...')
  const catIdMap = new Map()
  for (const [categoryIndex, category] of categories.entries()) {
    const { data, error } = await database.from('categories').insert({ name: category.name, slug: category.slug, icon: category.icon, sort_order: categoryIndex + 1 }).select('id').single()
    if (error)
      throw new Error(`导入分类「${category.name}」失败: ${error.message}`)
    catIdMap.set(String(category.origId ?? categoryIndex), data.id)
    onProgress('category', categoryIndex + 1, categories.length, `已导入分类：${category.name}`)
  }

  const subsBySlug = new Map() // slug -> {id}
  const subsByOrigId = new Map()
  for (const [categoryIndex, category] of categories.entries()) {
    const parentId = catIdMap.get(String(category.origId ?? categoryIndex))
    for (const [subcategoryIndex, subcategory] of category.children.entries()) {
      const { data, error } = await database.from('subcategories').insert({ category_id: parentId, name: subcategory.name, slug: subcategory.slug, sort_order: subcategoryIndex + 1 }).select('id').single()
      if (error)
        throw new Error(`导入子分类「${subcategory.name}」失败: ${error.message}`)
      const entry = { id: data.id, slug: subcategory.slug }
      subsBySlug.set(subcategory.slug, entry)
      subsByOrigId.set(String(subcategory.origId ?? `${categoryIndex}-${subcategoryIndex}`), entry)
    }
  }

  onProgress('site', 0, sites.length, '正在导入网址...')
  let inserted = 0
  let skipped = 0
  for (const [siteIndex, site] of sites.entries()) {
    const sub = subsBySlug.get(site.categoryCode)
    if (!sub) {
      skipped++
      continue
    }
    const { error } = await database.from('sites').insert({
      subcategory_id: sub.id,
      name: site.name,
      url: site.url,
      description: site.description,
      favicon_url: site.icon || undefined,
      is_featured: site.isRecommended,
      is_hot: site.isRecommended,
      is_new: false,
      click_count: site.views || 0,
      sort_order: siteIndex + 1,
    })
    if (error)
      throw new Error(`导入网址「${site.name}」失败: ${error.message}`)
    inserted++
    onProgress('site', siteIndex + 1, sites.length, `已导入网址：${site.name}`)
  }
  onProgress('done', inserted, sites.length, `导入完成：分类 ${categories.length}，子分类 ${subsBySlug.size}，网址 ${inserted}（跳过 ${skipped}）`)
  return { categories: categories.length, subcategories: subsBySlug.size, sites: inserted, skipped }
}
