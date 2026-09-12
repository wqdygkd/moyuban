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
