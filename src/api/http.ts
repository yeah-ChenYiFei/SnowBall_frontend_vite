// src/api/http.ts
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { useUserStore } from '@/stores/user'
import router from '@/router'
import type { Result } from '@/types'

type HttpInstance = AxiosInstance & {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<Result<T>>
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<Result<T>>
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<Result<T>>
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<Result<T>>
}

const http = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  timeout: 10000
}) as HttpInstance

http.interceptors.request.use(config => {
  const userStore = useUserStore()
  if (userStore.token) {
    config.headers.Authorization = `Bearer ${userStore.token}`
  }
  return config
})

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
    // ✅ 新增：处理网络断开/后端重启等情况（此时 error.response 为空）
    if (!error.response) {
      console.warn('网络连接异常，可能后端正在重启...')
      const userStore = useUserStore()
      userStore.logout() // 清理本地脏数据

      // 如果当前不在登录页，自动跳转过去
      if (router.currentRoute.value.path !== '/login') {
        router.push('/login')
      }
      return Promise.reject(new Error('网络连接异常，可能后端正在重启...'))
    }

    // 原有逻辑：处理有响应体但状态码不对的情况
    if (error.response.status === 401) {
      const userStore = useUserStore()
      userStore.logout()
      router.push('/login')
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }

    if (error.response.status === 403) {
      return Promise.reject(new Error('没有权限执行此操作'))
    }

    return Promise.reject(error)
  }
)

export default http
