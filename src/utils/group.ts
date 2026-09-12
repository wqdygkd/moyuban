/**
按 keyOf 分组：导入拼树 / 首页派生索引共用，避免各处手写 Map 循环
 */
export function groupBy<T>(list: readonly T[], keyOf: (item: T) => string | number | null | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of list) {
    const key = String(keyOf(item) ?? '')
    const bucket = map.get(key)
    if (bucket) bucket.push(item)
    else map.set(key, [item])
  }
  return map
}

/**
按 keyOf 计数：管理页统计子级占用（分类→子分类数、子分类→网址数）共用
 */
export function countBy<T>(list: readonly T[], keyOf: (item: T) => string | number | null | undefined): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of list) {
    const key = String(keyOf(item) ?? '')
    map.set(key, (map.get(key) || 0) + 1)
  }
  return map
}
