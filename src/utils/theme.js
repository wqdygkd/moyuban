import { ref } from 'vue'

const THEME_KEY = 'plnav-theme'
const THEMES = ['douyin', 'xhs', 'kuaishou', 'shipinhao']
const DEFAULT_THEME = 'douyin'

const current = ref(DEFAULT_THEME)

function apply(theme) {
  current.value = theme
  const body = document.body
  for (const t of THEMES) body.classList.remove(`theme-${t}`)
  body.classList.add(`theme-${theme}`)
  // 暗色主题（除小红书外）复用 EP 官方 dark css-vars 处理组件其余配色
  document.documentElement.classList.toggle('dark', theme !== 'xhs')
}

function init() {
  let saved
  try {
    saved = localStorage.getItem(THEME_KEY)
  } catch {}
  const theme = THEMES.includes(saved) ? saved : DEFAULT_THEME
  apply(theme)
  return theme
}

function set(theme) {
  if (!THEMES.includes(theme)) return current.value
  apply(theme)
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {}
  return theme
}

export function useTheme() {
  return { current, THEMES, DEFAULT_THEME, init, set }
}
