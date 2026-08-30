<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SiteFooter from '@/components/SiteFooter.vue'
import SiteHeader from '@/components/SiteHeader.vue'

const route = useRoute()
const isAdmin = computed(() => route.path.startsWith('/admin'))
</script>

<template>
  <div class="app-shell" :class="{ 'is-admin': isAdmin }">
    <SiteHeader v-if="!isAdmin" />
    <main class="app-main">
      <router-view />
    </main>
    <SiteFooter v-if="!isAdmin" />
  </div>
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
