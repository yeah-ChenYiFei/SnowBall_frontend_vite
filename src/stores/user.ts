// src/stores/user.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import http from '@/api/http'
import { ROLES } from '@/constants/role'
import type { UserInfo } from '@/types'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref<UserInfo | null>(null)

  let initPromise: Promise<void> | null = null

  // ✅ 核心新增：权限计算属性（全局唯一真相来源）
  const isAdmin = computed(() => userInfo.value?.role === ROLES.SYS_ADMIN)
  const isGroupAdmin = computed(() => userInfo.value?.role === ROLES.GROUP_ADMIN)
  const isAnyAdmin = computed(() => isAdmin.value || isGroupAdmin.value)
  const isRoot = computed(() => userInfo.value?.root === true)

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
    } catch (error: any) {
      // 401 时拦截器已处理登出+跳转，避免重复 logout
      if (error?.message !== '登录已过期，请重新登录') {
        logout()
      }
    }
  }

  const logout = () => {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('token')
  }

  const isLogin = () => !!token.value

  if (token.value && !userInfo.value?.id) {
    initPromise = fetchUserInfo()
  }

  const waitReady = () => initPromise || Promise.resolve()

  return {
    token, userInfo, login, logout, isLogin, fetchUserInfo, waitReady,
    // ✅ 导出权限状态
    isAdmin, isGroupAdmin, isAnyAdmin, isRoot
  }
})
