<script setup lang="ts">
import type { ThemeName } from '@/types'
import { themeLabel, useTheme } from '@/utils/theme'

// 主题切换下拉：SiteHeader 与 AdminLayout 共用，避免模板/样式双份维护
const { current, THEMES, set } = useTheme()
</script>

<template>
  <el-dropdown trigger="click" @command="(t: ThemeName) => set(t)">
    <button class="theme-toggle" title="切换主题">
      <span class="theme-dot" :class="`dot-${current}`" />
      <span class="theme-toggle-label">{{ themeLabel(current) }}</span>
      <el-icon class="theme-caret">
        <ArrowDown />
      </el-icon>
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item v-for="t in THEMES" :key="t" :command="t" class="theme-dropdown-item" :class="{ 'theme-active': t === current }">
          <span class="theme-dot" :class="`dot-${t}`" />
          {{ themeLabel(t) }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped lang="scss">
.theme-toggle {
  height: 34px;
  padding: 0 var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-full);
  background: var(--card-bg);
  color: var(--text-sub);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary-light-8);
    background: var(--el-color-primary-light-9);
  }
}

.theme-toggle-label {
  font-size: var(--text-foot);
  font-weight: 500;
}

.theme-caret {
  font-size: 12px;
}
</style>
