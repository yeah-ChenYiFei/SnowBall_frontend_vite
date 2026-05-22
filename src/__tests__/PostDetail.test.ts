import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}))

vi.mock('@/api/http', () => {
  return { default: { get: mockGet, post: mockPost } }
})

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ params: { id: '1' }, path: '/post/1' }),
}))

vi.mock('@/comments/CommentList.vue', () => ({
  default: { template: '<div class="mock-comment-list"></div>', props: ['postId'] },
}))

vi.mock('@/components/UserHoverMenu.vue', () => ({
  default: { template: '<div class="mock-hover"></div>', props: ['userId', 'source', 'triggerEl'] },
}))

vi.mock('@/components/ImageGallery.vue', () => ({
  default: { template: '<div class="mock-gallery"></div>', props: ['images'] },
}))

vi.mock('@/components/ImageLightbox.vue', () => ({
  default: { template: '<div class="mock-lightbox"></div>', props: ['images', 'modelValue'] },
}))

// Stub localStorage
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

import PostDetail from '@/views/post/PostDetail.vue'
import { useUserStore } from '@/stores/user'

describe('PostDetail.vue', () => {
  const mockPostData = {
    id: 1,
    userId: 1,
    title: 'Test Post',
    body: 'This is a test post content',
    type: 'THOUGHT',
    status: 'PUBLIC',
    createdAt: '2026-05-20T12:00:00',
    updatedAt: '2026-05-20T12:00:00',
    viewCount: 10,
    likeCount: 5,
    dislikeCount: 1,
    commentCount: 3,
    isFavorited: false,
    authorName: 'alice',
    tags: ['test'],
    images: [],
    currentUserReaction: null,
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    mockGet.mockResolvedValue({ data: { ...mockPostData }, code: 200, message: 'ok', timestamp: '' })
  })

  it('loads post on mount', async () => {
    const wrapper = mount(PostDetail, {
      global: {
        stubs: { routerLink: { template: '<a><slot/></a>' } },
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(wrapper.vm.post).not.toBeNull()
    expect(wrapper.vm.post?.title).toBe('Test Post')
  })

  it('shows favorite button when user is logged in', async () => {
    const userStore = useUserStore()
    userStore.token = 'test-token'
    userStore.userInfo = { id: 2, username: 'bob', role: 'USER' }

    const wrapper = mount(PostDetail, {
      global: {
        stubs: { routerLink: { template: '<a><slot/></a>' } },
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 50))

    const actionBtns = wrapper.findAll('.action-btn')
    const favButton = actionBtns.find(btn => btn.text().includes('收藏'))
    expect(favButton).toBeTruthy()
  })

  it('toggleFavorite adds favorite when not favorited', async () => {
    mockPost.mockResolvedValueOnce({ data: true, code: 200, message: 'ok', timestamp: '' })

    const userStore = useUserStore()
    userStore.token = 'test-token'
    userStore.userInfo = { id: 2, username: 'bob', role: 'USER' }

    const wrapper = mount(PostDetail, {
      global: {
        stubs: { routerLink: { template: '<a><slot/></a>' } },
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 50))

    await wrapper.vm.toggleFav()

    expect(mockPost).toHaveBeenCalledWith('/posts/1/favorite')
    expect(wrapper.vm.post?.isFavorited).toBe(true)
  })

  it('toggleFavorite removes favorite when already favorited', async () => {
    mockPost.mockResolvedValueOnce({ data: false, code: 200, message: 'ok', timestamp: '' })

    const userStore = useUserStore()
    userStore.token = 'test-token'
    userStore.userInfo = { id: 2, username: 'bob', role: 'USER' }

    const wrapper = mount(PostDetail, {
      global: {
        stubs: { routerLink: { template: '<a><slot/></a>' } },
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 50))

    // Manually set favorited since the mock data returns isFavorited: false
    wrapper.vm.post = { ...mockPostData, isFavorited: true }
    await wrapper.vm.toggleFav()

    expect(wrapper.vm.post?.isFavorited).toBe(false)
  })
})
