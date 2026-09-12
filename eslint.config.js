import { readFileSync } from 'node:fs'
import antfu from '@antfu/eslint-config'

// vue / vue-router 走 AutoImport 隐式导入（见 vite.config.js），
// 这里读插件生成的全局变量表，免得 no-undef 误报。
// 文件不存在时（刚克隆就跑 lint 且没跑过 dev/build）降级为空对象，
// 跑一次构建会自动生成。
let autoImportGlobals = {}
try {
  autoImportGlobals = JSON.parse(readFileSync(new URL('.eslintrc-auto-import.json', import.meta.url), 'utf8')).globals
} catch {}

export default antfu(
  {
    vue: true,
    stylistic: true,
    formatters: true,
    unicorn: { allRecommended: true },
    ignores: ['dist', 'node_modules', 'public', 'supabase/config.toml'],
  },
  {
    rules: {
      'antfu/if-newline': 'off',
      'style/brace-style': ['error', '1tbs', { allowSingleLine: false }],
    },
    languageOptions: {
      globals: autoImportGlobals,
    },
  },
)
