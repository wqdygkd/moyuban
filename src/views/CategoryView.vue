<script setup lang="ts">
import type { SiteHome } from '@/types'
import SiteCard from '@/components/SiteCard.vue'
import { useHomeData } from '@/composables/use-home-data'
import { groupBy } from '@/utils/group'

const route = useRoute()
const router = useRouter()
const { loading, error, categories, subcategories, sites, hasCache, loadData } = useHomeData()

const catId = computed(() => String(route.params.id ?? ''))
const category = computed(() => categories.value.find(c => String(c.id) === catId.value))
const subs = computed(() => subcategories.value.filter(s => String(s.category_id) === catId.value))
const sitesBySub = computed(() => groupBy(sites.value, s => s.subcategory_id))
function sitesOfSub(subId: string | number): SiteHome[] {
  return sitesBySub.value.get(String(subId)) || []
}
const totalSites = computed(() => subs.value.reduce((n, s) => n + sitesOfSub(s.id).length, 0))

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/')
}

onMounted(() => {
  // 与首页同一条加载链路：缓存秒开 + app_meta 版本差量刷新
  loadData({ silent: hasCache })
})
// 同组件内切换分类（路由复用）：数据已全量加载，只需回到顶部
watch(catId, () => window.scrollTo({ top: 0 }))
</script>

<template>
  <div class="page-container page-home">
    <div class="wrapper page-home-content">
      <el-skeleton v-if="loading" :rows="8" animated class="skeleton" />
      <el-empty v-else-if="error" :description="error">
        <el-button type="primary" @click="loadData()">
          重新加载
        </el-button>
      </el-empty>

      <template v-else-if="category">
        <div class="cat-page-head">
          <el-button class="cat-back" @click="goBack">
            <el-icon><Back /></el-icon>
            返回
          </el-button>
          <div class="cat-page-title">
            <span class="section-icon"><el-icon><component :is="category.icon || 'Folder'" /></el-icon></span>
            <h1 class="hero-title">
              {{ category.name }}
            </h1>
          </div>
          <p class="hero-sub">
            {{ subs.length }} 个子分类 <i>·</i> <b>{{ totalSites }}</b> 个网址
          </p>
        </div>

        <div v-for="sub in subs" :key="sub.id" class="category-anchor">
          <section class="category-section inview">
            <div class="section-header">
              <div class="section-title-wrap">
                <h2 class="section-title">
                  {{ sub.name }}
                </h2>
              </div>
            </div>
            <div class="section-content">
              <div v-if="sitesOfSub(sub.id).length" class="card-grid">
                <SiteCard v-for="site in sitesOfSub(sub.id)" :key="site.id" :site="site" />
              </div>
              <el-empty v-else :image-size="60" description="该子分类暂无网址" />
            </div>
          </section>
        </div>
        <el-empty v-if="!subs.length" :image-size="80" description="该分类暂无子分类" />
      </template>

      <el-empty v-else :image-size="80" description="分类不存在或已删除">
        <el-button type="primary" @click="router.push('/')">
          返回首页
        </el-button>
      </el-empty>
    </div>
  </div>
</template>

<style lang="scss" src="./styles/home.scss"></style>

<style scoped lang="scss">
.cat-page-head {
  margin-bottom: var(--space-5);
}
.cat-back {
  margin-bottom: var(--space-3);
}
.cat-page-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
</style>
