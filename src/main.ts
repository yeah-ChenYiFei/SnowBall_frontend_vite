import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// ✅ 应用挂载前，尝试用本地 Token 换取用户信息
import { useUserStore } from './stores/user'
const userStore = useUserStore()
if (userStore.isLogin()) {
  userStore.fetchUserInfo()
}

app.mount('#app')
