import { reactive } from 'vue'
import { supabase } from '@/lib/supabase'

const state = reactive({ user: undefined, session: undefined, initialized: false })

async function init() {
  if (!supabase) {
    state.initialized = true
    return
  }
  const { data } = await supabase.auth.getSession()
  state.session = data.session ?? undefined
  state.user = data.session?.user ?? undefined
  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session ?? undefined
    state.user = session?.user ?? undefined
  })
  state.initialized = true
}
async function loginWithPassword(email, password) {
  if (!supabase) throw new Error('Supabase 未配置')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  state.session = data.session
  state.user = data.user
}
async function logout() {
  if (supabase) await supabase.auth.signOut()
  state.session = undefined
  state.user = undefined
}

const store = reactive({
  get user() { return state.user },
  set user(v) { state.user = v },
  get session() { return state.session },
  set session(v) { state.session = v },
  get initialized() { return state.initialized },
  set initialized(v) { state.initialized = v },
  get isLoggedIn() { return !!state.session },
  init,
  loginWithPassword,
  logout,
})

export function useAuthStore() {
  return store
}
