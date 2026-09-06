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
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: false,
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'sass' })],
      dts: false,
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
          { src: 'favicon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
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
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
  optimizeDeps: {
    include: ['vue', 'vue-router', '@supabase/supabase-js'],
  },
  build: {
    target: 'esnext',
    cssMinify: 'esbuild',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
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
