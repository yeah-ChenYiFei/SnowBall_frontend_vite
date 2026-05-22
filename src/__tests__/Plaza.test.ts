import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import type { AxiosRequestConfig } from 'axios'

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
  return { default: { get: vi.fn() } }
})

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ path: '/' }),
}))

vi.mock('@/components/PostCard.vue', () => ({
  default: { template: '<div class="mock-post-card"></div>', props: ['post', 'imagePosition'] },
}))

vi.mock('@/components/UserHoverMenu.vue', () => ({
  default: { template: '<div class="mock-hover"></div>', props: ['userId', 'source', 'triggerEl'] },
}))

vi.mock('@/components/CreatePostModal.vue', () => ({
  default: { template: '<div class="mock-create-modal"></div>', props: [], emits: ['close', 'created'] },
}))

import http from '@/api/http'
import Plaza from '@/views/Plaza.vue'
import { useUserStore } from '@/stores/user'

describe('Plaza.vue', () => {
  beforeEach(() => {
    localStorageMock.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()

    const mockPosts = [
      {
        id: 1, userId: 1, title: 'Post 1', body: 'Content 1', type: 'THOUGHT',
        status: 'PUBLIC', createdAt: '2026-05-20T12:00:00', viewCount: 10,
        likeCount: 5, dislikeCount: 1, commentCount: 3, isFavorited: false,
        authorName: 'alice', tags: [], images: [],
      },
      {
        id: 2, userId: 1, title: 'Post 2', body: 'Content 2', type: 'THOUGHT',
        status: 'PUBLIC', createdAt: '2026-05-21T12:00:00', viewCount: 5,
        likeCount: 10, dislikeCount: 0, commentCount: 1, isFavorited: true,
        authorName: 'alice', tags: [], images: [],
      },
    ]

    vi.mocked(http.get).mockImplementation((url: string, config?: AxiosRequestConfig) => {
      if (url === '/posts') {
        return Promise.resolve({ data: mockPosts, code: 200, message: 'ok', timestamp: '' })
      }
      if (url === '/articles/diary-streak') {
        return Promise.resolve({ data: 7, code: 200, message: 'ok', timestamp: '' })
      }
      if (url === '/inspirations') {
        return Promise.resolve({ data: [], code: 200, message: 'ok', timestamp: '' })
      }
      return Promise.resolve({ data: null, code: 200, message: 'ok', timestamp: '' })
    })
  })

  it('renders sort tabs with default "new" active', () => {
    const userStore = useUserStore()
    userStore.token = 'test-token'

    const wrapper = mount(Plaza, {
      global: {
        stubs: { routerLink: { template: '<a><slot/></a>' } },
      },
    })

    const sortTabs = wrapper.findAll('.sort-tab')
    expect(sortTabs).toHaveLength(3)

    const newTab = sortTabs[1]
    expect(newTab.classes()).toContain('active')
    expect(newTab.text()).toBe('最新')
  })

  it('switches sort to "hot" when clicked', async () => {
    const userStore = useUserStore()
    userStore.token = 'test-token'

    const wrapper = mount(Plaza, {
      global: {
        stubs: { routerLink: { template: '<a><slot/></a>' } },
      },
    })

    const hotTab = wrapper.findAll('.sort-tab')[0]
    expect(hotTab.text()).toBe('热门')

    await hotTab.trigger('click')

    expect(hotTab.classes()).toContain('active')
  })

  it('switches sort to "top" when clicked', async () => {
    const userStore = useUserStore()
    userStore.token = 'test-token'

    const wrapper = mount(Plaza, {
      global: {
        stubs: { routerLink: { template: '<a><slot/></a>' } },
      },
    })

    const topTab = wrapper.findAll('.sort-tab')[2]
    expect(topTab.text()).toBe('最多赞')

    await topTab.trigger('click')

    expect(topTab.classes()).toContain('active')
  })

  it('shows login hint when not logged in', () => {
    const wrapper = mount(Plaza, {
      global: {
        stubs: { routerLink: { template: '<a><slot/></a>' } },
      },
    })

    const loginHint = wrapper.find('.insp-login-hint')
    expect(loginHint.exists()).toBe(true)
    expect(loginHint.text()).toBe('登录后查看灵感')
  })

  it('shows "create post" button when logged in', () => {
    const userStore = useUserStore()
    userStore.token = 'test-token'

    const wrapper = mount(Plaza, {
      global: {
        stubs: { routerLink: { template: '<a><slot/></a>' } },
      },
    })

    const btn = wrapper.find('.btn-create-post')
    expect(btn.exists()).toBe(true)
  })

  it('goToPost navigates to post detail', async () => {
    const wrapper = mount(Plaza, {
      global: {
        stubs: { routerLink: { template: '<a><slot/></a>' } },
      },
    })

    await wrapper.vm.goToPost(42)
    expect(mockPush).toHaveBeenCalledWith('/post/42')
  })
})
