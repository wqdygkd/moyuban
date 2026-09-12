import { BASE_62_DIGITS, generateKeyBetween } from 'fractional-indexing'

// fractional 文本排序键取最大（字典序比较，与 generateKeyBetween 语义一致）。
// 注意：刻意用手写循环而不用 toSorted/reduce——前者触发
// unicorn/require-array-sort-compare，后者触发 unicorn/no-array-reduce。
export function maxOrderKey(keys) {
  let last
  for (const key of keys) {
    if (last === undefined || last < key) last = key
  }
  return last
}

// 生成排到列表末尾的新排序键；前后邻居键非法时退化为追加到末尾。
// （调用方只有“末尾追加”一种需求：新增行、换组 moved 到新组末尾、拖拽落点计算
// 由 use-drag-order 的 nextOrderKey 负责。）
// keyOf 默认取 sort_order 字段，调用方可覆盖（如原始行结构不同）。
export function appendOrderKey(list, keyOf = item => item.sort_order) {
  const keys = list.map(item => keyOf(item)).filter(Boolean).map(String)
  return generateKeyBetween(maxOrderKey(keys), undefined, BASE_62_DIGITS)
}
