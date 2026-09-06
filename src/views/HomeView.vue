<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import SiteCard from '@/components/SiteCard.vue'
import { fetchCategories, fetchSites, fetchSubcategories, metaApi } from '@/services/api'
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
const menuRef = ref(null)

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
  featured.value = c.featured || (c.sites || []).filter(s => s.is_featured)
  return true
}
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
  if (!keyword.value?.trim()) return
  const q = encodeURIComponent(keyword.value.trim())
  const targets = {
    baidu: `https://www.baidu.com/s?wd=${q}`,
    bing: `https://www.bing.com/search?q=${q}`,
    google: `https://www.google.com/search?q=${q}`,
    site: `/search?q=${q}`,
  }
  window.open(targets[searchEngine.value] || targets.site, '_blank')
}

// ---------- 左侧菜单：左右双向联动 ----------
const leftActive = ref('')
const leftOpeneds = computed(() => {
  if (!leftActive.value) return []
  const sep = leftActive.value.indexOf('::')
  if (sep > 0) return [leftActive.value.slice(0, sep)]
  if (leftActive.value.startsWith('feature')) return ['feature']
  return []
})
function onMenuSelect(index) {
  if (index.startsWith('feature-')) {
    leftActive.value = index
    return setRecMode(index === 'feature-new' ? 'new' : 'hot')
  }
  const sep = index.indexOf('::')
  if (sep > 0) {
    const catId = index.slice(0, sep)
    const subId = index.slice(sep + 2)
    activeSub[catId] = subId
    activeSub[String(catId)] = subId
    leftActive.value = index
    scrollToId(catId)
  }
}
watch(leftOpeneds, (ids) => {
  nextTick(() => ids.forEach((id) => menuRef.value?.open?.(id)))
})

// ---------- 派生数据（Map 索引避免每行 filter） ----------
const subsByCat = computed(() => {
  const m = new Map()
  for (const s of subcategories.value) {
    const a = m.get(s.category_id)
    if (a) a.push(s)
    else m.set(s.category_id, [s])
  }
  return m
})
const sitesBySub = computed(() => {
  const m = new Map()
  for (const s of sites.value) {
    const a = m.get(s.subcategory_id)
    if (a) a.push(s)
    else m.set(s.subcategory_id, [s])
  }
  return m
})
const sitesByCat = computed(() => {
  const m = new Map()
  for (const cat of categories.value) {
    const subs = subsByCat.value.get(cat.id) || []
    const list = []
    for (const sub of subs) {
      const arr = sitesBySub.value.get(sub.id)
      if (arr) list.push(...arr)
    }
    m.set(cat.id, list)
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
function sitesOf(id) {
  const all = sitesByCat.value.get(id) || []
  const fid = activeSub[id]
  return fid ? (sitesBySub.value.get(String(fid)) || sitesBySub.value.get(fid) || []) : all
}
function activeSubOf(id) {
  return activeSub[id] ? String(activeSub[id]) : null
}
function initDefaultSubs() {
  for (const cat of categories.value) {
    const key = String(cat.id)
    if (activeSub[key] == null && activeSub[cat.id] == null) {
      const subs = subsOf(cat.id)
      if (subs.length) {
        const first = String(subs[0].id)
        activeSub[key] = first
        // 兼容数字键
        if (cat.id !== key) activeSub[cat.id] = first
      }
    }
  }
}
watch([categories, subcategories], () => {
  if (categories.value.length && subcategories.value.length) initDefaultSubs()
}, { immediate: true })

// ---------- 滚动 helpers ----------
let scrollLockTimer = null
let scrollLocked = false
function lockScroll(ms = 700) {
  scrollLocked = true
  clearTimeout(scrollLockTimer)
  scrollLockTimer = setTimeout(() => {
    scrollLocked = false
    updateActive()
  }, ms)
}
function scrollTo(el, opts = { behavior: 'smooth', block: 'start' }) {
  if (!el) return
  lockScroll()
  el.scrollIntoView(opts)
}
function scrollToId(catId) {
  scrollTo(document.getElementById(`cat-${catId}`))
}
const toggleCatId = scrollToId
function scrollToFeature() {
  scrollTo(document.querySelector('.category-anchor[data-scroll="feature"]'))
}
function toggleSub(cat, sub) {
  const cur = String(activeSub[cat.id] ?? activeSub[String(cat.id)] ?? '')
  const sid = String(sub.id)
  const next = cur === sid ? null : sid
  if (next) {
    activeSub[cat.id] = next
    activeSub[String(cat.id)] = next
  } else {
    activeSub[cat.id] = null
    activeSub[String(cat.id)] = null
  }
  leftActive.value = next ? `${cat.id}::${next}` : ''
}
function setRecMode(mode) {
  recMode.value = mode
  scrollToFeature()
}

// ---------- 卡片入场（精简：首屏直接 inview，其余 IO） ----------
let revealIo = null
async function setupReveal() {
  await nextTick()
  revealIo?.disconnect()
  revealIo = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('inview')
        revealIo.unobserve(e.target)
      }
    }
  }, { rootMargin: '0px 0px 500px 0px', threshold: 0 })
  for (const el of document.querySelectorAll('.category-section')) {
    if (el.getBoundingClientRect().top < window.innerHeight + 500) el.classList.add('inview')
    else revealIo.observe(el)
  }
}

// 按表按需拉取：版本一致则跳过
function isVersionEqual(a, b) {
  return a && b && a.cat === b.cat && a.sub === b.sub && a.site === b.site
}
async function loadData({ silent = false, force = false } = {}) {
  const cached = readHomeCache()
  const hasCache = !!cached
  if (!silent && !hasCache) loading.value = true
  if (!silent) error.value = ''
  try {
    let remote = null
    try {
      remote = await metaApi.getVersion()
    } catch (e) {
      if (!hasCache) throw e
      console.warn('[cache] 版本探测失败', e)
    }
    if (!force && isVersionEqual(remote, cached?.version)) return
    const v = cached?.version
    const needCats = force || !hasCache || !remote || !v || remote.cat !== v.cat
    const needSubs = force || !hasCache || !remote || !v || remote.sub !== v.sub
    const needSites = force || !hasCache || !remote || !v || remote.site !== v.site
    const [cats, subs, ss] = await Promise.all([
      needCats ? fetchCategories() : Promise.resolve(cached.categories),
      needSubs ? fetchSubcategories() : Promise.resolve(cached.subcategories),
      needSites ? fetchSites() : Promise.resolve(cached.sites),
    ])
    const feat = (needSites || !hasCache ? ss : cached.sites ?? ss).filter(s => s.is_featured)
    const next = { categories: cats, subcategories: subs, sites: ss, featured: feat, version: remote ?? v }
    applyCache(next)
    writeHomeCache(next)
  } catch (e) {
    if (!hasCache) error.value = e.message || '加载失败，请检查 Supabase 配置'
    else console.warn('[cache] 后台刷新失败', e)
  } finally {
    loading.value = false
    await setupReveal()
    setupActiveObserver()
  }
}

// ---------- 滚动高亮：scroll 扫描替代 IO（修复大区块误判） ----------
let activeIo = null
let activeRaf = null
let onScroll = null
function getHeaderOffset() {
  // 与 scroll-margin-top 保持一致：--ui-header-height(64) + --space-4(16) + 8 容差
  return 88
}
function updateActive() {
  if (scrollLocked) return
  const anchors = document.querySelectorAll('.category-anchor')
  if (!anchors.length) return
  const offset = getHeaderOffset()
  let best = null
  let bestTop = -Infinity
  for (const el of anchors) {
    const top = el.getBoundingClientRect().top
    if (top <= offset) {
      if (top > bestTop) {
        bestTop = top
        best = el
      }
    }
  }
  // 顶部未越过 offset 时保持首个（feature）
  if (!best) best = anchors[0]
  if (!best) return
  if (best.dataset.scroll === 'feature') {
    activeCat.value = null
  } else {
    const sec = best.querySelector('[id^="cat-"]')
    const raw = best.id?.startsWith('cat-') ? best.id.slice(4) : sec?.id?.slice(4) ?? null
    activeCat.value = raw ? String(raw) : null
  }
}
function setupActiveObserver() {
  activeIo?.disconnect()
  if (onScroll) window.removeEventListener('scroll', onScroll)
  if (activeRaf) cancelAnimationFrame(activeRaf)
  const anchors = document.querySelectorAll('.category-anchor')
  if (!anchors.length) return
  // rAF 节流的 scroll 扫描：对大区块也精准在 header 线切换
  onScroll = () => {
    if (scrollLocked) return
    if (activeRaf) return
    activeRaf = requestAnimationFrame(() => {
      activeRaf = null
      updateActive()
    })
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
  // IO 仅作补充触发（containment / 懒加载后重算），不依赖 entries
  activeIo = new IntersectionObserver(() => updateActive(), { rootMargin: '-88px 0px -55% 0px', threshold: 0 })
  for (const el of anchors) activeIo.observe(el)
  updateActive()
}

onMounted(async () => {
  if (readHomeCache()) {
    await setupReveal()
    setupActiveObserver()
    loadData({ silent: true })
    return
  }
  await loadData()
})
onBeforeUnmount(() => {
  revealIo?.disconnect()
  activeIo?.disconnect()
  if (onScroll) window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  if (activeRaf) cancelAnimationFrame(activeRaf)
  clearTimeout(scrollLockTimer)
})
</script>

<template>
  <div class="page-container page-home">
    <div class="page-home-top">
      <div class="layout-search">
        <div v-if="!loading" class="hero-intro">
          <h1 class="hero-title">
            {{ greeting }}
          </h1>
          <p class="hero-sub">
            已收录 <b>{{ sites.length }}</b> 个摸鱼入口 <i>·</i> 覆盖 <b>{{ categories.length }}</b> 个分类
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
      </div>
    </div>

    <el-skeleton v-if="loading" :rows="8" animated class="skeleton" />
    <el-empty v-else-if="error" :description="error">
      <el-button type="primary" @click="loadData({ force: true })">
        重新加载
      </el-button>
    </el-empty>

    <template v-else>
      <div class="wrapper page-home-content">
        <div class="page-main">
          <aside class="aside" :class="{ 'menu-open': sideOpen }">
            <div class="aside-sticky">
              <div class="aside-head">
                <span class="aside-kicker">INDEX / 目录</span>
                <span class="aside-count">{{ categories.length }} 分类 · {{ sites.length }} 站点</span>
              </div>
              <el-menu ref="menuRef" class="main-menu" unique-opened :default-active="leftActive" :default-openeds="leftOpeneds" @select="onMenuSelect">
                <el-sub-menu index="feature" :class="{ 'is-nav-active': !activeCat }">
                  <template #title>
                    <div class="sub-title-hit" @click.stop="scrollToFeature">
                      <span class="sub-icon-box"><el-icon><Trophy /></el-icon></span>
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
                <el-sub-menu v-for="cat in categories" :key="cat.id" :index="String(cat.id)" :class="{ 'is-nav-active': String(activeCat) === String(cat.id) }">
                  <template #title>
                    <div class="sub-title-hit" @click.stop="toggleCatId(cat.id)">
                      <span class="sub-icon-box"><el-icon><component :is="cat.icon || 'Folder'" /></el-icon></span>
                      <span>{{ cat.name }}</span>
                      <span class="sub-count">{{ subsOf(cat.id).length }}</span>
                    </div>
                  </template>
                  <el-menu-item v-for="sub in subsOf(cat.id)" :key="sub.id" :index="`${cat.id}::${sub.id}`" :class="{ 'is-active': String(activeSub[cat.id] ?? activeSub[String(cat.id)]) === String(sub.id) }">
                    <span class="sub-dot" />{{ sub.name }}
                  </el-menu-item>
                </el-sub-menu>
              </el-menu>
            </div>
            <div v-if="sideOpen" class="menu-backdrop menu-open" @click="sideOpen = false" />
            <el-button class="menu-toggle" circle @click="sideOpen = !sideOpen">
              <el-icon><Menu /></el-icon>
            </el-button>
          </aside>

          <div class="content">
            <div class="category-anchor" data-scroll="feature">
              <section class="category-section">
                <div class="section-header">
                  <div class="section-title-wrap">
                    <span class="section-index">00</span>
                    <span class="section-icon"><el-icon><Trophy /></el-icon></span>
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

            <div v-for="(cat, ci) in categories" :key="cat.id" class="category-anchor">
              <section :id="`cat-${cat.id}`" class="category-section">
                <div class="section-header">
                  <div class="section-title-wrap">
                    <span class="section-index">{{ String(ci + 1).padStart(2, '0') }}</span>
                    <span class="section-icon"><el-icon><component :is="cat.icon || 'Folder'" /></el-icon></span>
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
