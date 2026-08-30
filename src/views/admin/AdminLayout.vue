<script setup>
import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

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
          <div class="admin-user">
            <span class="admin-email">{{ auth.user?.email }}</span>
            <el-button text @click="handleLogout">
              <el-icon><SwitchButton /></el-icon>
              退出
            </el-button>
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
  background: rgb(var(--aside-bg));
  color: var(--text-on-primary);
  height: 100vh;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 700;
  padding: var(--space-5) var(--space-4);
  font-size: var(--text-md);
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
}

.admin-menu {
  background: transparent;
  border-right: none;
  flex: 1;

  :deep(.el-menu-item) {
    color: rgb(var(--aside-text));

    &:hover {
      background: var(--aside-hover);
    }

    &.is-active {
      background: var(--el-color-primary);
      color: var(--text-on-primary);
    }
  }
}

.admin-back {
  padding: var(--space-3) var(--space-3);
  border-top: 1px solid var(--aside-divider);

  .el-button {
    color: rgb(var(--aside-text));
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

.admin-user {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.admin-email {
  font-size: var(--text-foot);
  color: var(--text-sub);
}

.admin-main {
  padding: var(--space-5);
}
</style>
