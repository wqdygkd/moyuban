import antfu from '@antfu/eslint-config'

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
      'style/brace-style': 'off',
    },
  },
)
