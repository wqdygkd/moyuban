<script setup lang="ts">
import SiteCard from '@/components/SiteCard.vue'
import SiteSearch from '@/components/SiteSearch.vue'
import { useSiteSearch } from '@/composables/use-site-search'

const route = useRoute()
const { sites, ready, failed, ensure, search } = useSiteSearch()

onMounted(() => {
  void ensure()
})

const query = computed(() => String(route.query.q ?? '').trim())
const outcome = computed(() => search(query.value))
const tokens = computed(() => outcome.value.tokens)
const total = computed(() => outcome.value.sites.length)
</script>

<template>
  <div class="page-container page-home">
    <div class="wrapper page-home-content">
      <div class="search-head">
        <h1 class="hero-title">
          {{ query ? `「${query}」的搜索结果` : '站内搜索' }}
        </h1>
        <p class="hero-sub">
          <template v-if="query">
            共 <b>{{ total }}</b> 条结果 <i>·</i> 多个关键词用空格分隔，需同时命中
          </template>
          <template v-else>
            输入关键词，按名称、关键词、链接或简介搜索站内网址
          </template>
        </p>
        <div class="layout-search search-layout">
          <SiteSearch :query="query" />
        </div>
      </div>

      <el-empty v-if="!query" description="输入关键词开始搜索" />
      <template v-else-if="failed && !sites.length">
        <el-empty description="网址数据加载失败，请检查网络后重试">
          <el-button type="primary" @click="ensure()">
            重新加载
          </el-button>
        </el-empty>
      </template>
      <el-skeleton v-else-if="!ready && !sites.length" :rows="6" animated class="skeleton" />
      <template v-else-if="total">
        <div class="card-grid">
          <SiteCard v-for="site in outcome.sites" :key="site.id" :site="site" :highlight="tokens" />
        </div>
      </template>
      <el-empty v-else description="没有找到相关网址">
        <p class="search-tips">
          试试减少关键词，或换一种说法（支持名称、关键词、链接与简介字段）
        </p>
      </el-empty>
    </div>
  </div>
</template>

<style lang="scss" src="./styles/home.scss"></style>

<style scoped lang="scss">
.search-head {
  max-width: var(--ui-container);
  width: 100%;
  margin: var(--space-8) auto var(--space-5);
  text-align: center;
}
.search-layout {
  margin: var(--space-4) auto 0;
}
.search-tips {
  margin: 0;
  font-size: var(--text-sm);
  color: rgb(var(--color-text-secondary));
}
@media (max-width: 480px) {
  .search-head {
    text-align: left;
  }
}
</style>
