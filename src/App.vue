<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import SiteFooter from '@/components/SiteFooter.vue'
import SiteHeader from '@/components/SiteHeader.vue'

const route = useRoute()
const isAdmin = computed(() => route.path.startsWith('/admin'))
const locale = zhCn
</script>

<template>
  <el-config-provider :locale="locale">
    <div class="app-shell" :class="{ 'is-admin': isAdmin }">
      <SiteHeader v-if="!isAdmin" />
      <main class="app-main">
        <router-view />
      </main>
      <SiteFooter v-if="!isAdmin" />
    </div>
  </el-config-provider>
</template>

<style scoped lang="scss">
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.app-main {
  flex: 1;
}
.app-shell.is-admin {
  background: rgb(var(--color-bg));
}
</style>
