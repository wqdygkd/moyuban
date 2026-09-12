import type { ThemeName } from '@/types'

const THEME_KEY = 'theme'
const THEMES: readonly ThemeName[] = ['douyin', 'xhs', 'kuaishou', 'shipinhao']
const DEFAULT_THEME: ThemeName = 'douyin'

const current = ref<ThemeName>(DEFAULT_THEME)

function apply(theme: ThemeName): void {
  current.value = theme
  const body = document.body
  for (const t of THEMES) body.classList.remove(`theme-${t}`)
  body.classList.add(`theme-${theme}`)
}

function isThemeName(v: string | null | undefined): v is ThemeName {
  return (THEMES as readonly string[]).includes(v as string)
}

function init(): ThemeName {
  let saved: string | undefined
  try {
    saved = localStorage.getItem(THEME_KEY) ?? undefined
  } catch {
    // 无痕模式等异常直接用默认主题
  }
  const theme = isThemeName(saved) ? saved : DEFAULT_THEME
  apply(theme)
  return theme
}

function set(theme: ThemeName): ThemeName {
  if (!isThemeName(theme)) return current.value
  apply(theme)
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // 忽略持久化失败
  }
  return theme
}

export function useTheme() {
  return { current, THEMES, DEFAULT_THEME, init, set }
}
