import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { createApp } from 'vue'
import App from './App.vue'

import router, { setupRouterGuard } from './router'
import { useTheme } from './utils/theme'
import './styles/main.scss'

const app = createApp(App)

for (const [name, comp] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, comp)
}

app.use(router)
setupRouterGuard()

useTheme().init()

app.mount('#app')
