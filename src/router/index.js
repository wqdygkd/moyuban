import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/auth'

const routes = [
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true } },
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

let authInitPromise
export function setupRouterGuard() {
  router.beforeEach(async (to) => {
    const auth = useAuthStore()
    if (!auth.initialized) {
      // 并发守卫只 init 一次，避免重复 getSession
      // eslint-disable-next-line unicorn/no-top-level-assignment-in-function
      authInitPromise ??= auth.init()
      await authInitPromise
    }
    if (to.meta.requiresAuth && !auth.isLoggedIn)
      return { name: 'login', query: { redirect: to.fullPath } }
    if (to.meta.guestOnly && auth.isLoggedIn)
      return { name: 'home' }
    return true
  })
}

export default router
