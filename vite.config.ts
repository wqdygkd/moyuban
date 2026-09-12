import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    // vue / vue-router 走隐式导入：preset 覆盖全库用到的组合式 API，
    // 构建时由插件注回真实 import，产物与手写完全一致。
    // 注意 AutoImport 这里没有配 ElementPlusResolver：模板里的 el-* 标签和
    // v-loading 等指令由下面的 Components 负责；script 里的 ElMessage 等
    // 本仓约定全部手写（已全库核实无一遗漏），不再留隐式后门——漏写会被
    // eslint no-undef 直接拦下。之前两边都配属于重复，实测 AutoImport 那份
    // 从未触发过，这次删掉。
    // 附带产物：auto-imports.d.ts（编辑器补全）、.eslintrc-auto-import.json
    // （eslint.config.js 读它识别全局变量，两个文件都要提交）。
    AutoImport({
      imports: ['vue', 'vue-router'],
      dts: 'src/auto-imports.d.ts',
      dirs: ['src/composables', 'src/store'],
      vueTemplate: true,
      eslintrc: { enabled: true },
    }),
    // 模板里的 el-* 标签和 v-loading 等指令才需要自动引入，由 Components 负责。
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'sass' })],
      dts: 'src/components.d.ts',
      deep: true,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'favicon-128x128.png'],
      manifest: {
        name: '摸鱼办 - 上班摸鱼第一入口',
        short_name: '摸鱼办',
        description: '摸鱼办，上班摸鱼第一入口，集生活服务、实用工具、AI 领域等高效摸鱼集合地。',
        theme_color: '#0b0f16',
        background_color: '#0b0f16',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'favicon-128x128.png', sizes: '128x128', type: 'image/png' },
          // favicon.png 实际尺寸 1254x1254；无安全边距，只标 any 不标 maskable
          { src: 'favicon.png', sizes: '1254x1254', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: { maxEntries: 100, maxAgeSeconds: 43_200 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /^https:\/\/(faviconsnap\.com|icon\.horse|www\.google\.com\/s2\/favicons).*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'favicons',
              expiration: { maxEntries: 200, maxAgeSeconds: 604_800 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
    },
    dedupe: ['vue', 'vue-router'],
  },
  define: {
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false,
  },
  // sass-embedded 只有 modern API（Vite 8 已去掉 api 开关），无需配置。
  optimizeDeps: {
    include: ['vue', 'vue-router', '@supabase/supabase-js'],
  },
  build: {
    target: 'esnext',
    cssMinify: 'esbuild',
    // 关闭 CSS 按块拆分：home.scss 被 HomeView/CategoryView/SearchView 三个路由共享，
    // 拆分时它只随 HomeView 的 CSS 块下发，直接打开 /search 或 /category/:id 会缺样式
    // （搜索框不居中、卡片网格错乱）。全站 CSS 仅几十 KB，合成单文件并进 PWA 预缓存更稳。
    cssCodeSplit: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('element-plus')) return 'element-plus'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('vue-router')) return 'vue-router'
          if (id.includes('vue')) return 'vue'
          return 'vendor'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  esbuild: {
    legalComments: 'none',
  },
})
