import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Stub localStorage before Pinia store is imported
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true })

vi.mock('@/api/http', () => {
  return { default: { post: vi.fn(), get: vi.fn() } }
})

import http from '@/api/http'
import { useUserStore } from '@/stores/user'

describe('userStore', () => {
  beforeEach(() => {
    localStorageMock.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('isAdmin returns true when role is SYS_ADMIN', () => {
    const store = useUserStore()
    store.userInfo = { id: 1, username: 'admin', role: 'SYS_ADMIN' }

    expect(store.isAdmin).toBe(true)
    expect(store.isRoot).toBe(false)
  })

  it('isAdmin returns false for regular user', () => {
    const store = useUserStore()
    store.userInfo = { id: 2, username: 'user', role: 'USER' }

    expect(store.isAdmin).toBe(false)
  })

  it('isRoot returns true when root field is true', () => {
    const store = useUserStore()
    store.userInfo = { id: 1, username: 'root', role: 'SYS_ADMIN', root: true }

    expect(store.isRoot).toBe(true)
    expect(store.isAdmin).toBe(true)
  })

  it('isRoot returns false when root field is false', () => {
    const store = useUserStore()
    store.userInfo = { id: 2, username: 'admin2', role: 'SYS_ADMIN', root: false }

    expect(store.isRoot).toBe(false)
    expect(store.isAdmin).toBe(true)
  })

  it('isGroupAdmin returns true for GROUP_ADMIN', () => {
    const store = useUserStore()
    store.userInfo = { id: 3, username: 'gadmin', role: 'GROUP_ADMIN' }

    expect(store.isGroupAdmin).toBe(true)
    expect(store.isAdmin).toBe(false)
  })

  it('isAnyAdmin returns true for admin or group admin', () => {
    const store = useUserStore()
    store.userInfo = { id: 1, username: 'admin', role: 'SYS_ADMIN' }
    expect(store.isAnyAdmin).toBe(true)

    store.userInfo = { id: 2, username: 'gadmin', role: 'GROUP_ADMIN' }
    expect(store.isAnyAdmin).toBe(true)

    store.userInfo = { id: 3, username: 'user', role: 'USER' }
    expect(store.isAnyAdmin).toBe(false)
  })

  it('isLogin returns false without token', () => {
    const store = useUserStore()
    expect(store.isLogin()).toBe(false)
  })

  it('isLogin returns true with token', () => {
    const store = useUserStore()
    store.token = 'test-jwt-token'

    expect(store.isLogin()).toBe(true)
  })

  it('login fetches user info after login', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({
      data: { token: 'jwt-token' },
      code: 200, message: 'ok', timestamp: '',
    })
    vi.mocked(http.get).mockResolvedValueOnce({
      data: { id: 1, username: 'alice', role: 'SYS_ADMIN', root: true },
      code: 200, message: 'ok', timestamp: '',
    })

    const store = useUserStore()
    await store.login('alice', 'password')

    expect(store.token).toBe('jwt-token')
    expect(store.userInfo?.username).toBe('alice')
    expect(store.isRoot).toBe(true)
  })

  it('logout clears token and userInfo', () => {
    const store = useUserStore()
    store.token = 'some-token'
    store.userInfo = { id: 1, username: 'test', role: 'USER' }

    store.logout()

    expect(store.token).toBe('')
    expect(store.userInfo).toBeNull()
  })
})
