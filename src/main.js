import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'

import router, { setupRouterGuard } from './router'
import { useTheme } from './utils/theme'
import './styles/main.scss'

// 命令式 API 的样式不会被按需引入（模板里没有对应组件），需手动导入
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'

const app = createApp(App)

// 全量注册图标是有意为之，不是偷懒：分类图标是库里配的任意字符串
// （HomeView 用 <component :is="cat.icon || 'Folder'" /> 动态渲染），
// 按需注册会让用户配的图标静默消失。代价是图标包进 element-plus 分块，
// 接受这笔体积换动态能力；如将来图标收敛为固定集合，再改白名单注册。
for (const [name, comp] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, comp)
}

app.use(router)
setupRouterGuard()

useTheme().init()

app.mount('#app')
