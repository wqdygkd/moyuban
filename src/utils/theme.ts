import type { ThemeName } from '@/types'

const THEME_KEY = 'theme'
// 主题单一事实来源。注意：index.html 里防闪烁的内联脚本硬编码了同一份
// 主题列表（原生脚本无法 import TS），新增主题时必须同步修改。
const THEMES: readonly ThemeName[] = ['douyin', 'xhs', 'kuaishou', 'shipinhao']
const DEFAULT_THEME: ThemeName = 'douyin'

const THEME_LABELS: Record<ThemeName, string> = {
  douyin: '抖音',
  xhs: '小红书',
  kuaishou: '快手',
  shipinhao: '视频号',
}

export function themeLabel(theme: ThemeName): string {
  return THEME_LABELS[theme]
}

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
