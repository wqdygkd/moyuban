import type { Expression, FuseResultMatch } from 'fuse.js'
import type { SiteHome } from '@/types'
import Fuse from 'fuse.js'

type SearchField = 'name' | 'keywords' | 'url' | 'description'

// 权重：名称 > 关键词 > 链接 > 简介
const SEARCH_FIELDS: Array<{ field: SearchField, weight: number }> = [
  { field: 'name', weight: 0.5 },
  { field: 'keywords', weight: 0.25 },
  { field: 'url', weight: 0.15 },
  { field: 'description', weight: 0.1 },
]

// 字段命中优先级（排序用）：与权重同序。fuse 对精确包含命中一律 0 分，
// 字段权重只对模糊命中生效，精确命中的排序靠这里的字段优先级补足。
const FIELD_RANK: Record<SearchField, number> = { name: 0, keywords: 1, url: 2, description: 3 }

export function createSiteSearch(sites: SiteHome[]): Fuse<SiteHome> {
  return new Fuse(sites, {
    keys: SEARCH_FIELDS.map(({ field, weight }) => ({ name: field, weight })),
    useExtendedSearch: true,
    threshold: 0.35,
    ignoreLocation: true,
    includeMatches: true,
  })
}

export interface SiteSearchOutcome {
  sites: SiteHome[]
  /**
  分词后的干净词元，供命中词高亮使用
   */
  tokens: string[]
}

/**
 * 多关键词：空格分词，词间 AND，单个词跨字段 OR。
 * "'词" 是 extended search 的模糊包含匹配；长描述靠 ignoreLocation 不受位置惩罚。
 */
function matchAnyField(token: string): Expression {
  return {
    $or: SEARCH_FIELDS.map(({ field }) => ({ [field]: `'${token}` })),
  }
}

function bestFieldRank(matches: readonly FuseResultMatch[] | undefined): number {
  const list = matches ?? []
  let best = SEARCH_FIELDS.length
  for (const match of list) {
    const rank = FIELD_RANK[match.key as SearchField]
    if (rank !== undefined && rank < best) best = rank
  }
  return best
}

export function runSiteSearch(fuse: Fuse<SiteHome>, query: string): SiteSearchOutcome {
  // 上限 8 个词：防超长输入拖慢检索，超出部分丢弃（需求内约定俗成）
  const tokens = query
    .split(/\s+/)
    .map(token => token.replaceAll(/[\^'!=;,<>()\\$|"]/g, ''))
    .filter(Boolean)
    .slice(0, 8)
  if (tokens.length === 0) return { sites: [], tokens }

  const pattern: Expression = tokens.length === 1
    ? matchAnyField(tokens[0])
    : { $and: tokens.map(token => matchAnyField(token)) }
  // 按「命中的最优字段」重排（名称命中 > 关键词 > 链接 > 简介）；
  // 同档内保持库内 curated 顺序（V8 sort 稳定）
  const ranked = fuse
    .search(pattern)
    .map(found => ({ site: found.item, rank: bestFieldRank(found.matches) }))
    .toSorted((a, b) => a.rank - b.rank)
  return { sites: ranked.map(entry => entry.site), tokens }
}
