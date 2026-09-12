<script setup lang="ts">
import type { SiteHome } from '@/types'
import FaviconImg from '@/components/FaviconImg.vue'
import HighlightText from '@/components/HighlightText.vue'
import { useSiteSearch } from '@/composables/use-site-search'
import { siteApi } from '@/services/api'
import { getFaviconCandidates, getHost } from '@/utils/favicon'

// 判别联合：真实站点条目与「查看全部」伪条目字段互斥，不再用全可选字段混装
interface SuggestSiteItem { kind: 'site', value: string, site: SiteHome, tokens: string[] }
interface SuggestAllItem { kind: 'all', value: string, total: number }
type SuggestItem = SuggestSiteItem | SuggestAllItem

const props = withDefaults(defineProps<{
  /** hero 完整版显示搜索引擎切换与搜索按钮 */
  showEngines?: boolean
  /** 搜索页传入当前路由词，同步进输入框 */
  query?: string
}>(), { showEngines: false, query: '' })

const router = useRouter()
const { search, ensure } = useSiteSearch()
// el-autocomplete 实例：检索触发后关闭建议浮窗
const searchRef = ref<{ blur?: () => void, activated?: boolean }>()

// 挂载即预热数据：首个键入就有建议，而不是等第一次 fetchSuggestions 才拉
onMounted(() => {
  void ensure()
})

type SearchEngine = 'site' | 'baidu' | 'bing' | 'google'
const engineOptions: Array<{ label: string, value: SearchEngine }> = [
  { label: '本站', value: 'site' },
  { label: '百度', value: 'baidu' },
  { label: '必应', value: 'bing' },
  { label: '谷歌', value: 'google' },
]
const engine = ref<SearchEngine>('site')
const keyword = ref('')

// 搜索页场景：路由词变化（含进入页面首次）同步进输入框
watch(() => props.query, (q) => {
  keyword.value = q
}, { immediate: true })

const placeholder = computed(
  () => ({ site: '在本站内搜索网址…', baidu: '百度一下，你就知道…', bing: '必应搜索…', google: 'Google 搜索…' })[engine.value],
)

function fetchSuggestions(query: string, cb: (items: SuggestItem[]) => void): void {
  if (engine.value !== 'site') {
    cb([])
    return
  }
  void ensure()
  const { sites: found, tokens } = search(query)
  const items: SuggestItem[] = found
    .slice(0, 8)
    .map(site => ({ kind: 'site', value: site.name, site, tokens }))
  if (found.length) items.push({ kind: 'all', value: '', total: found.length })
  cb(items)
}

function onSiteOpen(site: SiteHome): void {
  window.open(site.url, '_blank', 'noopener')
  if (site.id) siteApi.incrementClick(site.id).catch(() => {})
}

function onSelect(item: Record<string, any>): void {
  const entry = item as SuggestItem
  if (entry.kind === 'site') onSiteOpen(entry.site)
}

function goSearch(): void {
  const q = keyword.value.trim()
  if (!q) return
  router.push({ path: '/search', query: { q } })
}

function doSearch(): void {
  const q = keyword.value.trim()
  if (!q) return
  closeSuggestPanel()
  if (engine.value !== 'site') {
    // 外链参数必须编码：& # % 等字符会截断 query
    const eq = encodeURIComponent(q)
    const targets: Record<Exclude<SearchEngine, 'site'>, string> = {
      baidu: `https://www.baidu.com/s?wd=${eq}`,
      bing: `https://www.bing.com/search?q=${eq}`,
      google: `https://www.google.com/search?q=${eq}`,
    }
    window.open(targets[engine.value], '_blank', 'noopener')
    return
  }
  goSearch()
}

// 回车检索与点击「搜索」按钮完全等价。捕获阶段拦截并阻断冒泡，
// 避免 el-autocomplete 把回车处理成“选中高亮建议”导致不检索；
// 输入法组词中的回车是确认候选字，不触发。
function onSearchKeydown(event: KeyboardEvent): void {
  if (event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  event.stopPropagation()
  doSearch()
}

// 收起建议浮窗。浮窗可见性 = 有候选 && activated；组件源码的 close() 就是把
// activated 置否（expose 出来的 ref，经实例代理可直接赋值）。blur() 走异步
// handleBlur 且可能被「焦点在浮窗内」判定短路，单独依赖不可靠。
function closeSuggestPanel(): void {
  const instance = searchRef.value
  if (!instance) return
  try {
    instance.activated = false
  } catch {
    // expose 代理异常时忽略，浮窗随导航/失焦自然关闭，不阻塞检索主流程
  }
  instance.blur?.()
}
</script>

<template>
  <div class="site-search">
    <el-segmented v-if="showEngines" v-model="engine" class="engine-segmented" :options="engineOptions" size="large" />
    <form class="search-form" role="search" @submit.prevent="doSearch" @keydown.enter.capture="onSearchKeydown">
      <el-icon class="search-icon">
        <Search />
      </el-icon>
      <el-autocomplete
        ref="searchRef"
        v-model.trim="keyword"
        class="search-field"
        :fetch-suggestions="fetchSuggestions"
        :placeholder="placeholder"
        :debounce="150"
        :trigger-on-focus="false"
        :highlight-first-item="false"
        clearable
        popper-class="search-suggest-popper"
        @select="onSelect"
      >
        <template #default="{ item }">
          <div
            v-if="item.kind === 'all'"
            class="suggest-all"
            @mousedown.stop.prevent
            @click.stop="doSearch()"
          >
            查看全部 {{ item.total }} 条结果
            <el-icon><ArrowRight /></el-icon>
          </div>
          <div v-else-if="item.kind === 'site'" class="suggest-item">
            <FaviconImg
              :candidates="getFaviconCandidates({ url: item.site.url })"
              :alt="item.site.name"
              :size="28"
              img-class="suggest-fav"
            >
              <span class="suggest-letter">{{ item.site.name[0] }}</span>
            </FaviconImg>
            <span class="suggest-main">
              <span class="suggest-name">
                <HighlightText :text="item.site.name" :tokens="item.tokens" />
              </span>
              <span v-if="item.site.description" class="suggest-desc">
                <HighlightText :text="item.site.description" :tokens="item.tokens" />
              </span>
            </span>
            <span class="suggest-host" :title="item.site.url">{{ getHost(item.site.url) }}</span>
          </div>
        </template>
      </el-autocomplete>
      <el-button class="search-btn" type="primary" round native-type="submit">
        搜索
      </el-button>
    </form>
  </div>
</template>

<style scoped lang="scss">
/* 搜索表单/引擎切换的视觉样式在 views/styles/home.scss（首页/搜索页共用，保持与原版一致）。
   这里只放建议下拉条目的自有样式。 */

/* 建议下拉条目（slot 内容带本组件 scope，popper 容器样式见下方全局块） */
.suggest-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 8px 6px;
}
.suggest-fav {
  border-radius: var(--radius-sm);
}
.suggest-letter {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: rgb(var(--color-primary) / 0.1);
  color: rgb(var(--color-primary));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
}
.suggest-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.suggest-name {
  color: rgb(var(--color-text));
  font-size: var(--text-sm);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.suggest-desc {
  color: rgb(var(--color-text-secondary));
  font-size: var(--text-foot);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.suggest-host {
  flex-shrink: 0;
  max-width: 35%;
  color: rgb(var(--color-text-muted));
  font-size: var(--text-foot);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.suggest-all {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px var(--space-2);
  margin-top: var(--space-1);
  color: rgb(var(--color-primary));
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  border-top: 1px solid rgb(var(--color-border) / 0.6);
}
</style>

<style lang="scss">
/* 建议浮窗 teleport 到 body，只能用全局样式；配色全部走主题 token，
   与卡片/搜索框同一套变量，各主题下自动适配 */
.search-suggest-popper.el-popper {
  background: rgb(var(--color-bg-card));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-pop);
  overflow: hidden;

  /* 搜索面板形态：不带小箭头 */
  .el-popper__arrow {
    display: none;
  }

  .el-autocomplete-suggestion {
    border-radius: 0;
  }

  .el-autocomplete-suggestion__wrap {
    max-height: min(380px, 60vh);
    padding: var(--space-2);
  }

  /* 候选行：圆角悬浮高亮，与卡片 hover 语言一致（覆盖 EP 的 34px 行高/20px 内边距） */
  .el-autocomplete-suggestion__list li {
    padding: 0 var(--space-1);
    border-radius: var(--radius-md);
    line-height: 1.45;
    white-space: normal;
    transition: background 0.15s;

    &:hover,
    &.highlighted {
      background: rgb(var(--color-bg-card-hover));
    }
  }
}
</style>
