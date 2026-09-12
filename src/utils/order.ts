import type { Orderable } from '@/types'
import { BASE_62_DIGITS, generateKeyBetween } from 'fractional-indexing'

/**
全站唯一的排序键工厂：BASE_62_DIGITS 只在此一处出现
 */
export function nextKey(previous?: string | null, next?: string | null): string {
  return generateKeyBetween(previous || undefined, next || undefined, BASE_62_DIGITS)
}

// fractional 文本排序键取最大（字典序比较，与 generateKeyBetween 语义一致）。
// 注意：刻意用手写循环而不用 toSorted/reduce——前者触发
// unicorn/require-array-sort-compare，后者触发 unicorn/no-array-reduce。
export function maxOrderKey(keys: Array<string | number>): string | undefined {
  let last: string | undefined
  for (const key of keys) {
    const k = String(key)
    if (last === undefined || last < k) last = k
  }
  return last
}

// 生成排到列表末尾的新排序键；前后邻居键非法时退化为追加到末尾。
// （调用方只有“末尾追加”一种需求：新增行、换组 moved 到新组末尾、拖拽落点计算
// 由 use-drag-order 的 nextOrderKey 负责。）
// keyOf 默认取 sort_order 字段，调用方可覆盖（如原始行结构不同）。
export function appendOrderKey<T extends Pick<Orderable, 'sort_order'>>(list: T[], keyOf: (item: T) => Orderable['sort_order'] = item => item.sort_order): string {
  const keys = list.map(item => keyOf(item)).filter(Boolean).map(String)
  return nextKey(maxOrderKey(keys))
}
