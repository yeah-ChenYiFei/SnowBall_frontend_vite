// src/api/http.ts
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { useUserStore } from '@/stores/user'
import router from '@/router'
import type { Result } from '@/types'

// 公开路径：处于这些路径时 401 不跳转登录页，只静默清除 token
function isPublicPathFor401(path: string): boolean {
  const publics = ['/', '/login', '/register', '/explore', '/about', '/wild/chains']
  if (publics.includes(path)) return true
  if (/^\/post\/\d+$/.test(path)) return true
  if (/^\/chain\/\d+$/.test(path)) return true
  if (/^\/wild\/chains\/\d+$/.test(path)) return true
  if (/^\/wild\/chains$/.test(path)) return true
  if (/^\/wild\/worlds/.test(path)) return true
  if (/^\/wild\/library/.test(path)) return true
  return false
}

type HttpInstance = AxiosInstance & {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<Result<T>>
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<Result<T>>
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<Result<T>>
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<Result<T>>
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000
}) as HttpInstance

http.interceptors.request.use(config => {
  const userStore = useUserStore()
  if (userStore.token) {
    config.headers.Authorization = `Bearer ${userStore.token}`
  }
  return config
})

let isRedirectingToLogin = false

http.interceptors.response.use(
  response => {
    const res = response.data as Result
    if (res.code !== 200) {
      const error = new Error(res.message || '请求失败')
      ;(error as any).code = res.code
      return Promise.reject(error)
    }
    return res as any
  },
  error => {
    // 处理从成功拦截器 reject 出来的业务错误（有 code 但无 response）
    if ((error as any).code && !error.response) {
      return Promise.reject(error)
    }

    // 处理网络断开/后端重启等情况（此时 error.response 为空）
    if (!error.response) {
      console.warn('网络连接异常，可能后端正在重启...')
      // 网络不通时不强制登出，等后端恢复即可
      return Promise.reject(new Error('网络连接异常，请稍后重试'))
    }

    // 处理 401：公开页面不跳转登录，仅静默清除过期 token
    if (error.response.status === 401) {
      const userStore = useUserStore()
      const hadToken = !!userStore.token
      userStore.logout()
      if (hadToken && !isRedirectingToLogin && !isPublicPathFor401(router.currentRoute.value.path)) {
        isRedirectingToLogin = true
        router.push('/login').finally(() => {
          isRedirectingToLogin = false
        })
      }
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }

    if (error.response.status === 403) {
      const msg = error.response.data?.message || '没有权限执行此操作'
      return Promise.reject(new Error(msg))
    }

    return Promise.reject(error)
  }
)

export default http
