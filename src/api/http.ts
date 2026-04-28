// src/api/http.ts
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { useUserStore } from '@/stores/user'
import router from '@/router'
import type { Result } from '@/types'

// ✅ 终极修复：使用交叉类型 (&)
// 左边 AxiosInstance 保留了 interceptors 等所有原生属性
// 右边覆盖了 get/post 等方法的返回值，强制返回 Result 结构
type HttpInstance = AxiosInstance & {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<Result<T>>
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<Result<T>>
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<Result<T>>
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<Result<T>>
}

const http = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  timeout: 10000
}) as HttpInstance // ✅ 断言为终极混合类型

// ✅ 现在 interceptors 不会报错了
http.interceptors.request.use(config => {
  const userStore = useUserStore()
  if (userStore.token) {
    config.headers.Authorization = `Bearer ${userStore.token}`
  }
  // console.log('======== 当前发送请求带的 Token 是：', userStore.token)

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
    // ✅ 在组件里调用 http.get() 时，TS 会知道它返回的是 Result
    return res as any
  },
  error => {
    if (error.response?.status === 401) {
      const userStore = useUserStore()
      userStore.logout()
      router.push('/login')
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }
    if (error.response?.status === 403) {
      return Promise.reject(new Error('没有权限执行此操作'))
    }
    return Promise.reject(error)
  }
)

export default http
