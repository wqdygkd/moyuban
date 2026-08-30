import { ArrowDown, Back, Delete, Download, Folder, FolderOpened, Link, Lock, Menu, Message, Plus, Search, Setting, SwitchButton, Trophy, Upload, UploadFilled } from '@element-plus/icons-vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { createApp } from 'vue'
import App from './App.vue'

import router, { setupRouterGuard } from './router'
import { useTheme } from './utils/theme'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/element/index.scss'
import './styles/main.scss'

const app = createApp(App)

const iconEntries = Object.entries({ Search, Trophy, Menu, ArrowDown, Setting, SwitchButton, Link, Folder, FolderOpened, Upload, Plus, Message, Lock, Back, Download, Delete, UploadFilled })
for (const [name, comp] of iconEntries) {
  app.component(name, comp)
}

setupRouterGuard()

app.use(router)
app.use(ElementPlus, { locale: zhCn })

useTheme().init()

app.mount('#app')
