import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { createApp } from 'vue'
import App from './App.vue'

import router, { setupRouterGuard } from './router'
import { useTheme } from './utils/theme'
import './styles/main.scss'

// 命令式 API 的样式不会被按需引入（模板里没有对应组件），需手动导入
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'

const app = createApp(App)

for (const [name, comp] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, comp)
}

app.use(router)
setupRouterGuard()

useTheme().init()

app.mount('#app')
