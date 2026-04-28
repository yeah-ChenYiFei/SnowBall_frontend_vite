// src/stores/user.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import http from '@/api/http'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref<any>({ name: '', username: '' })

  // ✅ 用于存储初始化时的异步请求 Promise
  let initPromise: Promise<void> | null = null

  const login = async (username: string, password: string) => {
    const res = await http.post('/auth/login', { username, password })
    const jwtToken = res.data.token
    token.value = jwtToken
    localStorage.setItem('token', jwtToken)
    await fetchUserInfo()
  }

  const fetchUserInfo = async () => {
    try {
      const res = await http.get('/auth/me')
      userInfo.value = res.data
    } catch (error) {
      logout()
    }
  }

  const logout = () => {
    token.value = ''
    userInfo.value = { name: '', username: '' }
    localStorage.removeItem('token')
  }

  const isLogin = () => !!token.value

  // ✅ 刷新页面时，如果有 token 就自动拉取信息，并把 Promise 存起来
  if (token.value && !userInfo.value.id) {
    initPromise = fetchUserInfo()
  }

  // ✅ 暴露给组件调用的方法：如果有正在进行的初始化，就等它完成
  const waitReady = () => initPromise || Promise.resolve()

  return {
    token,
    userInfo,
    login,
    logout,
    isLogin,
    fetchUserInfo,
    waitReady  // ✅ 导出它
  }
})
