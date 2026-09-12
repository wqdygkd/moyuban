const THEME_KEY = 'theme'
const THEMES = ['douyin', 'xhs', 'kuaishou', 'shipinhao']
const DEFAULT_THEME = 'douyin'

const current = ref(DEFAULT_THEME)

function apply(theme) {
  current.value = theme
  const body = document.body
  for (const t of THEMES) body.classList.remove(`theme-${t}`)
  body.classList.add(`theme-${theme}`)
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
