<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import SiteCard from '@/components/SiteCard.vue'
import { categoryApi, siteApi, subcategoryApi } from '@/services/api'
import { readHomeCache, writeHomeCache } from '@/utils/cache'

const loading = ref(true)
const error = ref('')
const categories = ref([])
const subcategories = ref([])
const sites = ref([])
const featured = ref([])
const recMode = ref('hot')
const activeSub = reactive({})
const activeCat = ref(null)
const sideOpen = ref(false)

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了，摸鱼人也该睡了'
  if (h < 11) return '早上好，摸鱼人'
  if (h < 14) return '中午好，吃饱了才好摸鱼'
  if (h < 18) return '下午好，摸鱼人'
  return '晚上好，今天的班辛苦啦'
})

function applyCache(c) {
  if (!c) return false
  categories.value = c.categories || []
  subcategories.value = c.subcategories || []
  sites.value = c.sites || []
  featured.value = c.featured || []
  return true
}
// 同步尝试读取本地缓存，秒开不白屏
const _cached = readHomeCache()
if (_cached) {
  applyCache(_cached)
  loading.value = false
}

const engineOptions = [
  { label: '本站', value: 'site' },
  { label: '百度', value: 'baidu' },
  { label: '必应', value: 'bing' },
  { label: '谷歌', value: 'google' },
]
const searchEngine = ref('site')
const keyword = ref('')
const searchPlaceholder = computed(
  () => ({ site: '在本站内搜索网址…', baidu: '百度一下，你就知道…', bing: '必应搜索…', google: 'Google 搜索…' })[searchEngine.value],
)

function doSearch() {
  if (!keyword.value) return
  const q = encodeURIComponent(keyword.value)
  const targets = {
    baidu: `https://www.baidu.com/s?wd=${q}`,
    bing: `https://www.bing.com/search?q=${q}`,
    google: `https://www.google.com/search?q=${q}`,
    site: `/search?q=${q}`,
  }
  window.open(targets[searchEngine.value] || targets.site, '_blank')
}

// ---------- 左侧菜单 ----------
function onMenuSelect(index) {
  if (index.startsWith('feature-')) return setRecMode(index === 'feature-new' ? 'new' : 'hot')
  const sep = index.indexOf('::')
  if (sep > 0) {
    const catId = index.slice(0, sep)
    activeSub[catId] = index.slice(sep + 2)
    scrollToId(catId)
  }
}

// ---------- 派生数据（Map 索引避免每行 filter） ----------
const subsByCat = computed(() => {
  const m = new Map()
  for (const s of subcategories.value) {
    const a = m.get(s.category_id)
    a ? a.push(s) : m.set(s.category_id, [s])
  }
  return m
})
const featuredList = computed(() => {
  if (recMode.value === 'new') return [...featured.value].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  const hot = featured.value.filter(s => s.is_hot)
  return hot.length ? hot : featured.value
})
function subsOf(id) {
  return subsByCat.value.get(id) || []
}
function sitesOf(categoryId) {
  const ids = new Set(subsOf(categoryId).map(s => s.id))
  const fid = activeSub[categoryId]
  return sites.value.filter(s => ids.has(s.subcategory_id) && (!fid || s.subcategory_id === fid))
}
function activeSubOf(id) {
  return activeSub[id] || null
}

// ---------- 滚动 helpers（合并） ----------
function scrollTo(el, opts = { behavior: 'smooth', block: 'start' }) {
  el?.scrollIntoView(opts)
}
function scrollToId(catId) {
  scrollTo(document.getElementById(`cat-${catId}`))
}
const toggleCatId = scrollToId
function scrollToFeature() {
  scrollTo(document.querySelector('.category-anchor[data-scroll="feature"]'))
}
function toggleSub(cat, sub) {
  activeSub[cat.id] = activeSub[cat.id] === sub.id ? null : sub.id
}
function setRecMode(mode) {
  recMode.value = mode
  scrollToFeature()
}

// ---------- 卡片入场 ----------
let revealIo = null
async function setupReveal() {
  await nextTick()
  revealIo?.disconnect()
  revealIo = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('inview')
          revealIo.unobserve(e.target)
        }
      }
    },
    { rootMargin: '-30px 0px 0px 0px' },
  )
  document.querySelectorAll('.category-section').forEach(el => revealIo.observe(el))
}

// ---------- 数据加载（stale-while-revalidate：有缓存时静默刷新） ----------
async function loadData({ silent = false } = {}) {
  const hasCache = !!readHomeCache()
  // 有缓存则静默刷新，不展示 loading / 不清空 error 的白屏
  if (!silent && !hasCache) loading.value = true
  if (!silent) error.value = ''
  try {
    const [cats, subs, allSites, feat] = await Promise.all([categoryApi.list(), subcategoryApi.list(), siteApi.list(), siteApi.listFeatured()])
    const next = { categories: cats, subcategories: subs, sites: allSites, featured: feat }
    applyCache(next)
    writeHomeCache(next)
    // 有缓存但接口失败会走到 catch，这里只有成功才清 error
    error.value = ''
  } catch (e) {
    // 有缓存时静默失败，不覆盖页面，保留本地数据
    if (!hasCache) error.value = e.message || '加载失败，请检查 Supabase 配置是否完成'
    else console.warn('[cache] 后台刷新失败，继续使用本地缓存', e)
  } finally {
    loading.value = false
    await setupReveal()
  }
}

// ---------- 滚动高亮 ----------
const SCROLL_LINE = 80
let ticking = false
function updateActive() {
  const featureEl = document.querySelector('.category-anchor[data-scroll="feature"]')
  let cur = null
  if (featureEl && featureEl.getBoundingClientRect().top <= SCROLL_LINE) cur = null
  for (const cat of categories.value) {
    const el = document.getElementById(`cat-${cat.id}`)
    if (el && el.getBoundingClientRect().top <= SCROLL_LINE) cur = cat.id
    else if (el) break
  }
  activeCat.value = cur
}
function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    updateActive()
    ticking = false
  })
}

onMounted(async () => {
  // 若同步命中缓存，已首屏渲染；此处后台静默刷新并覆盖
  const hasCache = !!readHomeCache()
  if (hasCache) {
    // 缓存已渲染，先建立动效与高亮
    await setupReveal()
    updateActive()
    window.addEventListener('scroll', onScroll, { passive: true })
    // 后台刷新
    loadData({ silent: true })
    return
  }
  await loadData()
  updateActive()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  revealIo?.disconnect()
})
</script>

<template>
  <div class="page-container page-home">
    <!-- ===== 顶部搜索区 ===== -->
    <div class="page-home-top">
      <div class="layout-search">
        <div v-if="!loading" class="hero-intro">
          <h1 class="hero-title">
            {{ greeting }}
          </h1>
          <p class="hero-sub">
            已收录
            <b>{{ sites.length }}</b>
            个摸鱼入口
            <i>·</i>
            覆盖
            <b>{{ categories.length }}</b>
            个分类
          </p>
        </div>

        <el-segmented v-model="searchEngine" class="engine-segmented" :options="engineOptions" size="large" />

        <form class="search-form" role="search" @submit.prevent="doSearch">
          <el-icon class="search-icon">
            <Search />
          </el-icon>
          <el-input v-model.trim="keyword" class="search-field" :placeholder="searchPlaceholder" @keyup.enter="doSearch" />
          <el-button class="search-btn" type="primary" round @click="doSearch">
            搜索
          </el-button>
        </form>

        <div v-if="categories.length" class="hero-quick">
          <span class="quick-label">快速直达</span>
          <button v-for="cat in categories.slice(0, 5)" :key="cat.id" class="quick-chip" type="button" @click="toggleCatId(cat.id)">
            <el-icon><component :is="cat.icon" /></el-icon>
            {{ cat.name }}
          </button>
        </div>
      </div>
    </div>

    <el-skeleton v-if="loading" :rows="8" animated class="skeleton" />
    <el-empty v-else-if="error" :description="error">
      <el-button type="primary" @click="loadData">
        重新加载
      </el-button>
    </el-empty>

    <template v-else>
      <!-- ===== 主体 ===== -->
      <div class="wrapper page-home-content">
        <div class="page-main">
          <!-- 左侧分类菜单 -->
          <aside class="aside" :class="{ 'menu-open': sideOpen }">
            <div class="aside-sticky">
              <div class="aside-head">
                <span class="aside-kicker">INDEX / 目录</span>
                <span class="aside-count">{{ categories.length }} 分类 · {{ sites.length }} 站点</span>
              </div>

              <el-menu class="main-menu" unique-opened @select="onMenuSelect">
                <el-sub-menu index="feature" :class="{ 'is-nav-active': !activeCat }">
                  <template #title>
                    <div class="sub-title-hit" @click.stop="scrollToFeature">
                      <span class="sub-icon-box">
                        <el-icon><Trophy /></el-icon>
                      </span>
                      <span>智能推荐</span>
                      <span class="sub-count">{{ featured.length }}</span>
                    </div>
                  </template>
                  <el-menu-item index="feature-hot">
                    热门
                  </el-menu-item>
                  <el-menu-item index="feature-new">
                    最新
                  </el-menu-item>
                </el-sub-menu>

                <el-sub-menu v-for="cat in categories" :key="cat.id" :index="String(cat.id)" :class="{ 'is-nav-active': activeCat === cat.id }">
                  <template #title>
                    <div class="sub-title-hit" @click.stop="toggleCatId(cat.id)">
                      <span class="sub-icon-box">
                        <el-icon><component :is="cat.icon" /></el-icon>
                      </span>
                      <span>{{ cat.name }}</span>
                      <span class="sub-count">{{ subsOf(cat.id).length }}</span>
                    </div>
                  </template>
                  <el-menu-item v-for="sub in subsOf(cat.id)" :key="sub.id" :index="`${cat.id}::${sub.id}`">
                    <span class="sub-dot" />
                    {{ sub.name }}
                  </el-menu-item>
                </el-sub-menu>
              </el-menu>
            </div>

            <div v-if="sideOpen" class="menu-backdrop menu-open" @click="sideOpen = false" />
            <el-button class="menu-toggle" circle @click="sideOpen = !sideOpen">
              <el-icon><Menu /></el-icon>
            </el-button>
          </aside>

          <!-- 右侧内容 -->
          <div class="content">
            <!-- 智能推荐 -->
            <div class="category-anchor" data-scroll="feature">
              <section class="category-section">
                <div class="section-header">
                  <div class="section-title-wrap">
                    <span class="section-index">00</span>
                    <span class="section-icon">
                      <el-icon><Trophy /></el-icon>
                    </span>
                    <h2 class="section-title">
                      智能推荐
                    </h2>
                  </div>
                  <span class="section-meta">{{ featuredList.length }} 个推荐</span>
                </div>

                <div class="child-tabs">
                  <el-check-tag :checked="recMode === 'hot'" @change="setRecMode('hot')">
                    热门
                  </el-check-tag>
                  <el-check-tag :checked="recMode === 'new'" @change="setRecMode('new')">
                    最新
                  </el-check-tag>
                </div>

                <div class="section-content">
                  <div v-if="featuredList.length" class="card-grid">
                    <SiteCard v-for="(site, idx) in featuredList" :key="site.id" :site="site" :style="{ '--i': idx }" />
                  </div>
                  <el-empty v-else :image-size="60" description="暂无推荐内容" />
                </div>
              </section>
            </div>

            <!-- 各分类 -->
            <div v-for="(cat, ci) in categories" :key="cat.id" class="category-anchor">
              <section :id="`cat-${cat.id}`" class="category-section">
                <div class="section-header">
                  <div class="section-title-wrap">
                    <span class="section-index">{{ String(ci + 1).padStart(2, '0') }}</span>
                    <span class="section-icon">
                      <el-icon><component :is="cat.icon" /></el-icon>
                    </span>
                    <h2 class="section-title">
                      {{ cat.name }}
                    </h2>
                  </div>
                  <span class="section-meta">{{ sitesOf(cat.id).length }} 个网站</span>
                </div>

                <div class="child-tabs">
                  <el-check-tag v-for="sub in subsOf(cat.id)" :key="sub.id" :checked="activeSubOf(cat.id) === sub.id" @change="toggleSub(cat, sub)">
                    {{ sub.name }}
                  </el-check-tag>
                </div>

                <div class="section-content">
                  <div v-if="sitesOf(cat.id).length" class="card-grid">
                    <SiteCard v-for="(site, idx) in sitesOf(cat.id)" :key="site.id" :site="site" :style="{ '--i': idx }" />
                  </div>
                  <el-empty v-else :image-size="60" description="该分类暂无网址" />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" src="./styles/home.scss"></style>
