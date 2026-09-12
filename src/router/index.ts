import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/auth'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true } },
  { path: '/category/:id', name: 'category', component: () => import('@/views/CategoryView.vue') },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { requiresAuth: true },
    redirect: { name: 'admin-sites' },
    children: [
      { path: 'sites', name: 'admin-sites', component: () => import('@/views/admin/SiteManageView.vue') },
      { path: 'categories', name: 'admin-categories', component: () => import('@/views/admin/CategoryManageView.vue') },
      { path: 'subcategories', name: 'admin-subcategories', component: () => import('@/views/admin/SubcategoryManageView.vue') },
      { path: 'import', name: 'admin-import', component: () => import('@/views/admin/ImportView.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

// 首个守卫触发时才初始化，并发导航复用同一个 promise，避免重复 getSession。
// 用容器对象存 promise：模块级 let 在函数内赋值会触发 unicorn/no-top-level-assignment-in-function。
const authInitState: { promise?: Promise<void> } = {}
export function setupRouterGuard(): void {
  router.beforeEach(async (to) => {
    const auth = useAuthStore()
    if (!auth.initialized) {
      authInitState.promise ??= auth.init()
      await authInitState.promise
    }
    if (to.meta.requiresAuth && !auth.isLoggedIn)
      return { name: 'login', query: { redirect: to.fullPath } }
    if (to.meta.guestOnly && auth.isLoggedIn)
      return { name: 'home' }
    return true
  })
}

export default router
