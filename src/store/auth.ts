import type { AuthState, Session, Subscription, User } from '@/types'
import { supabase } from '@/lib/supabase'

const user = ref<User | undefined>()
const session = ref<Session | undefined>()
const initialized = ref(false)
const isLoggedIn = computed(() => !!session.value)
// 用容器对象存订阅：模块级 let 在函数内赋值会触发 unicorn/no-top-level-assignment-in-function。
const authSubscription: { current: Subscription | undefined } = { current: undefined }

async function init(): Promise<void> {
  if (!supabase) {
    initialized.value = true
    return
  }
  const { data } = await supabase.auth.getSession()
  session.value = data.session ?? undefined
  user.value = data.session?.user ?? undefined
  authSubscription.current?.unsubscribe()
  const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
    session.value = nextSession ?? undefined
    user.value = nextSession?.user ?? undefined
  })
  authSubscription.current = sub?.subscription ?? undefined
  initialized.value = true
}

async function loginWithPassword(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Supabase 未配置')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  session.value = data.session ?? undefined
  user.value = data.user ?? undefined
}

async function logout(): Promise<void> {
  authSubscription.current?.unsubscribe()
  authSubscription.current = undefined
  // 本地登录态先同步清理，UI 立刻退出；再吊销服务端 token，
  // 即使这一步挂起/失败，页面也不会卡在登录态。
  session.value = undefined
  user.value = undefined
  if (supabase) {
    try {
      await supabase.auth.signOut()
    } catch (signOutError) {
      console.warn('服务端登出失败，本地登录态已清理', signOutError)
    }
  }
}

// reactive 会自动解包嵌套的 ref：模板和普通 JS 里 auth.isLoggedIn/auth.user
// 拿到的都是原始值（布尔/对象），不会拿到 Ref 对象（Ref 恒为真值，曾导致
// 未登录也显示头像、守卫永远放行，登录按钮永远不显示）。
const singleton: AuthState = reactive({ user, session, initialized, isLoggedIn, init, loginWithPassword, logout })
export function useAuthStore(): AuthState {
  return singleton
}
