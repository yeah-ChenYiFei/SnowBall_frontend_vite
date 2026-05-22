import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFriendStore } from '@/stores/friend'

vi.mock('@/api/http', () => {
  const mockGet = vi.fn()
  const mockPost = vi.fn()
  const mockPut = vi.fn()
  const mockDelete = vi.fn()
  return {
    default: { get: mockGet, post: mockPost, put: mockPut, delete: mockDelete },
  }
})

import http from '@/api/http'

describe('friendStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads friends successfully', async () => {
    const mockFriends = [{ userId: 2, username: 'bob', since: '2026-01-01' }]
    vi.mocked(http.get).mockResolvedValueOnce({ data: mockFriends, code: 200, message: 'ok', timestamp: '' })

    const store = useFriendStore()
    await store.loadFriends()

    expect(store.friends).toEqual(mockFriends)
  })

  it('handles loadFriends error silently', async () => {
    vi.mocked(http.get).mockRejectedValueOnce(new Error('network error'))

    const store = useFriendStore()
    await store.loadFriends()

    expect(store.friends).toEqual([])
  })

  it('checkStatus returns FRIEND status', async () => {
    const status = { status: 'FRIEND' as const }
    vi.mocked(http.get).mockResolvedValueOnce({ data: status, code: 200, message: 'ok', timestamp: '' })

    const store = useFriendStore()
    const result = await store.checkStatus(2)

    expect(result.status).toBe('FRIEND')
    expect(store.statusCache.get(2)).toEqual({ status: 'FRIEND' })
  })

  it('checkStatus returns NONE on error', async () => {
    vi.mocked(http.get).mockRejectedValueOnce(new Error('not found'))

    const store = useFriendStore()
    const result = await store.checkStatus(2)

    expect(result.status).toBe('NONE')
  })

  it('sendRequest clears status cache for target user', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({ data: null, code: 200, message: 'ok', timestamp: '' })
    vi.mocked(http.get).mockResolvedValueOnce({ data: { status: 'FRIEND' }, code: 200, message: 'ok', timestamp: '' })

    const store = useFriendStore()
    await store.checkStatus(5)
    expect(store.statusCache.has(5)).toBe(true)

    await store.sendRequest(5, 'PROFILE')
    expect(store.statusCache.has(5)).toBe(false)
  })

  it('acceptRequest clears requester cache and reloads', async () => {
    vi.mocked(http.put).mockResolvedValueOnce({ data: null, code: 200, message: 'ok', timestamp: '' })
    vi.mocked(http.get).mockResolvedValue({ data: [], code: 200, message: 'ok', timestamp: '' })

    const store = useFriendStore()
    store.pendingRequests = [{ id: 99, userId: 7, username: 'eva', since: '' }]
    store.statusCache.set(7, { status: 'PENDING_FROM_THEM' })

    await store.acceptRequest(99)

    expect(store.statusCache.has(7)).toBe(false)
  })

  it('rejectRequest clears requester cache and reloads pending', async () => {
    vi.mocked(http.put).mockResolvedValueOnce({ data: null, code: 200, message: 'ok', timestamp: '' })
    vi.mocked(http.get).mockResolvedValue({ data: [], code: 200, message: 'ok', timestamp: '' })

    const store = useFriendStore()
    store.pendingRequests = [{ id: 88, userId: 8, username: 'sam', since: '' }]
    store.statusCache.set(8, { status: 'PENDING_FROM_THEM' })

    await store.rejectRequest(88)

    expect(store.statusCache.has(8)).toBe(false)
  })

  it('unfriend clears cache and reloads friends', async () => {
    vi.mocked(http.delete).mockResolvedValueOnce({ data: null, code: 200, message: 'ok', timestamp: '' })
    vi.mocked(http.get).mockResolvedValue({ data: [], code: 200, message: 'ok', timestamp: '' })

    const store = useFriendStore()
    store.friends = [{ id: 42, userId: 9, username: 'tim', since: '' }]
    store.statusCache.set(9, { status: 'FRIEND' })

    await store.unfriend(42)

    expect(store.statusCache.has(9)).toBe(false)
  })

  it('init loads friends and pending once if not loaded', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [], code: 200, message: 'ok', timestamp: '' })

    const store = useFriendStore()
    expect(store.loaded).toBe(false)

    await store.init()
    expect(store.loaded).toBe(true)
    expect(http.get).toHaveBeenCalledTimes(2)

    await store.init()
    expect(http.get).toHaveBeenCalledTimes(2)
  })
})
