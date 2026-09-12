<script setup lang="ts">
import type { ThemeName } from '@/types'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/store/auth'
import { useTheme } from '@/utils/theme'

const auth = useAuthStore()
const theme = useTheme()
const THEMES = theme.THEMES
const currentTheme = computed(() => theme.current.value)

const THEME_LABEL: Record<ThemeName, string> = {
  douyin: '抖音',
  xhs: '小红书',
  kuaishou: '快手',
  shipinhao: '视频号',
}

function themeLabel(t: ThemeName): string {
  return THEME_LABEL[t] || t
}

function onThemeCommand(t: ThemeName): void {
  theme.set(t)
}

const avatarText = computed(() => {
  const email = auth.user?.email || 'U'
  return email[0].toUpperCase()
})

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return // 点取消：直接返回，避免 unhandled rejection 刷屏
  }
  await auth.logout()
  ElMessage.success('已退出登录')
}
</script>

<template>
  <header class="site-header">
    <div class="container header-inner">
      <router-link to="/" class="brand">
        <span class="brand-mark">摸</span>
        <span class="brand-name">摸鱼办</span>
        <span class="brand-sub">上班摸鱼第一入口</span>
      </router-link>

      <div class="header-right">
        <el-dropdown trigger="click" @command="onThemeCommand">
          <button class="theme-toggle" title="切换主题">
            <span class="theme-dot" :class="`dot-${currentTheme}`" />
            <span class="theme-toggle-label">{{ themeLabel(currentTheme) }}</span>
            <el-icon class="theme-caret">
              <ArrowDown />
            </el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="t in THEMES" :key="t" :command="t" class="theme-dropdown-item" :class="{ 'theme-active': t === currentTheme }">
                <span class="theme-dot" :class="`dot-${t}`" />
                {{ themeLabel(t) }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <div class="auth-area">
          <template v-if="auth.isLoggedIn">
            <el-dropdown>
              <span class="user-chip">
                <span class="user-avatar">{{ avatarText }}</span>
                <span class="user-name">{{ auth.user?.email?.split('@')[0] }}</span>
                <el-icon><ArrowDown /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="$router.push('/admin')">
                    <el-icon><Setting /></el-icon>
                    网址管理
                  </el-dropdown-item>
                  <el-dropdown-item divided @click="handleLogout">
                    <el-icon><SwitchButton /></el-icon>
                    退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <el-button v-else type="primary" @click="$router.push('/login')">
            登录
          </el-button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.site-header {
  background: color-mix(in srgb, var(--card-bg) 75%, transparent);
  border-bottom: 1px solid var(--border-soft);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: var(--shadow-header);
  backdrop-filter: blur(12px) saturate(160%);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
}

.header-inner {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  height: var(--ui-header-height);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  background: var(--grad-brand);
  color: var(--text-on-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-brand);
  font-weight: 700;
}

.brand-name {
  font-size: var(--text-brand);
  font-weight: 700;
  color: var(--text-main);
}

.brand-sub {
  font-size: var(--text-xxs);
  color: var(--text-sub);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-shrink: 0;
  margin-left: auto;
}

.theme-toggle {
  height: 34px;
  padding: 0 var(--space-2) 0 var(--space-2);
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

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-hair);
  cursor: pointer;
  outline: none;
}

.user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: var(--text-on-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: 600;
}

.user-name {
  font-size: var(--text-sm);
  color: var(--text-main);
}

@media (max-width: 960px) {
  .brand-sub {
    display: none;
  }
}
</style>
