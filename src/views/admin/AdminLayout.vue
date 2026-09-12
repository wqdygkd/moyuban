<script setup>
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/store/auth'
import { useTheme } from '@/utils/theme'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const theme = useTheme()
const THEME_LABEL = { douyin: '抖音', xhs: '小红书', kuaishou: '快手', shipinhao: '视频号' }
const currentTheme = computed(() => theme.current.value)
function onThemeCommand(t) {
  theme.set(t)
}

const pageTitle = computed(() => {
  const map = {
    'admin-sites': '网址管理',
    'admin-categories': '分类管理',
    'admin-subcategories': '子分类管理',
    'admin-import': '数据导入',
  }
  return map[route.name] || '管理后台'
})

function goHome() {
  router.push('/')
}

async function handleLogout() {
  await auth.logout()
  ElMessage.success('已退出登录')
  router.push('/')
}
</script>

<template>
  <div class="admin">
    <el-container>
      <el-aside width="220px" class="admin-aside">
        <div class="admin-brand">
          <span class="admin-logo">摸</span>
          <span>摸鱼办管理</span>
        </div>
        <el-menu :default-active="$route.path" router class="admin-menu">
          <el-menu-item index="/admin/sites">
            <el-icon><Link /></el-icon>
            <span>网址管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/categories">
            <el-icon><Folder /></el-icon>
            <span>分类管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/subcategories">
            <el-icon><FolderOpened /></el-icon>
            <span>子分类管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/import">
            <el-icon><Upload /></el-icon>
            <span>数据导入</span>
          </el-menu-item>
        </el-menu>

        <div class="admin-back">
          <el-button text @click="goHome">
            <el-icon><Back /></el-icon>
            返回首页
          </el-button>
        </div>
      </el-aside>

      <el-container>
        <el-header class="admin-header">
          <div class="admin-title">
            {{ pageTitle }}
          </div>
          <div class="admin-header-right">
            <el-dropdown trigger="click" @command="onThemeCommand">
              <button class="theme-toggle" title="切换主题">
                <span class="theme-dot" :class="`dot-${currentTheme}`" />
                <span class="theme-toggle-label">{{ THEME_LABEL[currentTheme] || currentTheme }}</span>
                <el-icon class="theme-caret">
                  <ArrowDown />
                </el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="t in theme.THEMES" :key="t" :command="t" class="theme-dropdown-item" :class="{ 'theme-active': t === currentTheme }">
                    <span class="theme-dot" :class="`dot-${t}`" />{{ THEME_LABEL[t] || t }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <div class="admin-user">
              <span class="admin-email">{{ auth.user?.email }}</span>
              <el-button text @click="handleLogout">
                <el-icon><SwitchButton /></el-icon>
                退出
              </el-button>
            </div>
          </div>
        </el-header>
        <el-main class="admin-main">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<style scoped lang="scss">
.admin {
  min-height: 100vh;
  background: rgb(var(--color-bg));
}

.admin-aside {
  background: linear-gradient(180deg, rgb(var(--color-primary) / 0.08), transparent 320px), rgb(var(--aside-bg));
  color: var(--text-on-primary);
  height: 100vh;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  border-right: 1px solid rgb(var(--color-primary) / 0.08);
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 700;
  padding: var(--space-5) var(--space-4);
  font-size: var(--text-md);
  border-bottom: 1px solid var(--aside-divider);
  position: relative;
  &::after {
    content: '';
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: -1px;
    height: 1px;
    background: var(--grad-brand);
    opacity: 0.55;
  }
}

.admin-logo {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: var(--grad-brand);
  color: var(--text-on-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 700;
  box-shadow: var(--shadow-brand-sm);
}

.admin-menu {
  background: transparent;
  border-right: none;
  flex: 1;
  padding: var(--space-2) var(--space-2);

  :deep(.el-menu-item) {
    color: rgb(var(--aside-text));
    border-radius: var(--radius-md);
    margin: 2px 0;
    height: 38px;
    line-height: 38px;
    transition:
      background 0.2s,
      color 0.2s,
      box-shadow 0.2s;

    &:hover {
      background: rgb(var(--color-primary) / 0.1);
      color: var(--el-color-primary-light-3);
    }

    &.is-active {
      background: var(--grad-brand);
      color: var(--text-on-primary);
      box-shadow: var(--shadow-brand-sm);
    }

    .el-icon {
      font-size: 16px;
    }
  }
}

.admin-back {
  padding: var(--space-3) var(--space-3);
  border-top: 1px solid var(--aside-divider);

  .el-button {
    color: rgb(var(--aside-text));
    border-radius: var(--radius-md);
    &:hover {
      background: rgb(var(--color-primary) / 0.1);
      color: var(--el-color-primary-light-3);
    }
  }
}

.admin-header {
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
}

.admin-title {
  font-size: var(--text-brand);
  font-weight: 700;
  color: var(--text-main);
}

.admin-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.admin-user {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.admin-email {
  font-size: var(--text-foot);
  color: var(--text-sub);
}

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

.admin-main {
  padding: var(--space-5);
}
</style>
