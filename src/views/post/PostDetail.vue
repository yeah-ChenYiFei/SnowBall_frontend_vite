<!-- src/views/post/PostDetail.vue -->
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import { ROLES } from '@/constants/role' // ✅ 引入角色常量
import CommentList from '@/comments/CommentList.vue'
import UserHoverMenu from '@/components/UserHoverMenu.vue'
import ImageGallery from '@/components/ImageGallery.vue'
import ImageLightbox from '@/components/ImageLightbox.vue'
import type { Post } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const post = ref<Post | null>(null)
const isLoading = ref(true)

// Hover menu
const hoverUserId = ref(0)
const hoverEl = ref<HTMLElement | null>(null)
const showHoverMenu = ref(false)
let hoverTimer: ReturnType<typeof setTimeout> | null = null
function onAuthorEnter(e: MouseEvent, userId: number) {
  if (hoverTimer) clearTimeout(hoverTimer)
  hoverUserId.value = userId; hoverEl.value = e.currentTarget as HTMLElement; showHoverMenu.value = true
}
function onAuthorLeave() { hoverTimer = setTimeout(() => { showHoverMenu.value = false }, 500) }

const typeMap: Record<string, string> = {
  OC: '原创角色', SETTING: '世界观', FRAGMENT: '小说片段', BOOK_INFO: '书籍信息',
  THOUGHT: '散帖', ESSAY: '散文', DIARY: '日记', NOVEL: '小说',
}

// 计算属性：判断当前登录用户是不是这篇帖子的作者
const isAuthor = computed(() => {
  return post.value && userStore.userInfo?.id === post.value.userId
})

// ✅ 规范化：使用常量判断，替代 'SYS_ADMIN' 魔法字符串
const isAdmin = computed(() => {
  return userStore.userInfo?.role === ROLES.SYS_ADMIN
})

const loadPost = async () => {
  try {
    const res = await http.get(`/posts/${route.params.id}`)
    post.value = res.data
    // Record browsing history to localStorage
    if (post.value && userStore.userInfo?.id) {
      const key = `browseHistory_${userStore.userInfo?.id}`
      try {
        const stored = localStorage.getItem(key)
        const history: { postId: number; postTitle: string; postType: string; authorName?: string; viewedAt: string }[] = stored ? JSON.parse(stored) : []
        // Remove existing entry for same post, add at front
        const filtered = history.filter(h => h.postId !== post.value!.id)
        filtered.unshift({
          postId: post.value.id,
          postTitle: post.value.title,
          postType: post.value.type,
          authorName: post.value.authorName,
          viewedAt: new Date().toISOString(),
        })
        localStorage.setItem(key, JSON.stringify(filtered.slice(0, 50)))
      } catch { /* */ }
    }
  } catch (error) {
    console.error('加载失败', error)
  } finally {
    isLoading.value = false
  }
}

// Like/Dislike for post
const handleReact = async (type: 'LIKE' | 'DISLIKE') => {
  if (!userStore.isLogin()) return alert('请先登录')
  if (!post.value) return
  try {
    await http.post(`/posts/${post.value.id}/react`, null, { params: { reactionType: type } })
    if (post.value.currentUserReaction === type) {
      post.value.currentUserReaction = null
      if (type === 'LIKE') post.value.likeCount = (post.value.likeCount || 0) - 1
      else post.value.dislikeCount = (post.value.dislikeCount || 0) - 1
    } else {
      if (post.value.currentUserReaction === 'LIKE') post.value.likeCount = (post.value.likeCount || 0) - 1
      if (post.value.currentUserReaction === 'DISLIKE') post.value.dislikeCount = (post.value.dislikeCount || 0) - 1
      post.value.currentUserReaction = type
      if (type === 'LIKE') post.value.likeCount = (post.value.likeCount || 0) + 1
      else post.value.dislikeCount = (post.value.dislikeCount || 0) + 1
    }
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

// 普通用户：删除自己的帖子
const handleDelete = async () => {
  if (!confirm('确定要删除这篇帖子吗？')) return
  try {
    await http.delete(`/posts/${route.params.id}`)
    alert('删除成功')
    router.push('/')
  } catch (error: any) {
    alert('删除失败：' + (error.message || '权限不足'))
  }
}

// 管理员强删帖子
const handleAdminDelete = async () => {
  if (!confirm('⚠️ 警告：此操作为管理员强删，数据将不可恢复！')) return
  try {
    await http.delete(`/posts/admin/${route.params.id}`)
    alert('强删成功')
    router.push('/')
  } catch (error: any) {
    alert('操作失败：' + (error.message || '无权限'))
  }
}

onMounted(() => { loadPost() })
</script>

<template>
  <div class="detail-page">
    <div v-if="isLoading" class="loading">加载中...</div>

    <div v-else-if="post" class="detail-layout">
      <!-- Left 2/3: Image Gallery -->
      <div class="detail-gallery">
        <ImageGallery v-if="post.images?.length" :images="post.images" :alt="post.title" />
        <div v-else class="no-image-placeholder">
          <span class="placeholder-icon">📝</span>
          <span class="placeholder-text">纯文本内容</span>
        </div>
      </div>

      <!-- Right 1/3: Content -->
      <div class="detail-content">
        <button class="btn-back" @click="router.back()">← 返回</button>

        <div class="post-header">
          <span class="type-badge">{{ typeMap[post.type] || post.type }}</span>
        </div>

        <h1 class="post-title">{{ post.title }}</h1>

        <div class="post-meta">
          <span
            class="author-link"
            @click.stop="router.push(`/profile/${post.userId}`)"
            @mouseenter.stop="onAuthorEnter($event, post.userId)"
            @mouseleave="onAuthorLeave"
          >👤 {{ post.authorName || '匿名' }}</span>
          <span class="meta-sep">·</span>
          <span>{{ new Date(post.createdAt).toLocaleDateString() }}</span>
          <span class="meta-sep">·</span>
          <span>V{{ post.version }}</span>
        </div>

        <div class="post-stats">
          <span>👁️ {{ post.viewCount || 0 }} 阅读</span>
          <span>👍 {{ post.likeCount || 0 }}</span>
          <span>👎 {{ post.dislikeCount || 0 }}</span>
          <span>💬 {{ post.commentCount || 0 }} 评论</span>
        </div>

        <div v-if="post.tags && post.tags.length > 0" class="post-tags">
          <span v-for="tag in post.tags" :key="tag" class="tag-pill">#{{ tag }}</span>
        </div>

        <div class="post-body">
          <p v-for="(line, index) in post.body.split('\n')" :key="index">{{ line }}</p>
        </div>

        <div class="action-bar">
          <button
            class="action-btn react-btn"
            :class="{ liked: post.currentUserReaction === 'LIKE' }"
            @click="handleReact('LIKE')"
          >👍 赞 {{ post.likeCount || 0 }}</button>
          <button
            class="action-btn react-btn"
            :class="{ disliked: post.currentUserReaction === 'DISLIKE' }"
            @click="handleReact('DISLIKE')"
          >👎 踩 {{ post.dislikeCount || 0 }}</button>
          <span class="action-spacer"></span>
          <template v-if="isAuthor">
            <button class="action-btn" @click="router.push(`/post/${post.id}/edit`)">✏️ 编辑</button>
            <button class="action-btn" @click="router.push(`/post/${post.id}/versions`)">📜 历史</button>
            <button class="action-btn btn-danger" @click="handleDelete">🗑️ 删除</button>
          </template>
          <template v-else-if="isAdmin">
            <button class="action-btn btn-admin-danger" @click="handleAdminDelete">🛡️ 强删</button>
          </template>
        </div>

        <CommentList :post-id="post.id" />
      </div>
    </div>

    <UserHoverMenu
      v-if="showHoverMenu && hoverEl && hoverUserId"
      :user-id="hoverUserId"
      source="POST"
      :trigger-el="hoverEl"
      @close="showHoverMenu = false"
      @cancelClose="if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }"
    />

    <div v-else class="error-state">
      <p>帖子不存在或已被删除</p>
      <router-link to="/">返回广场</router-link>
    </div>
  </div>
</template>

<style scoped>
.detail-page { width: 100%; min-height: 100vh; }
.loading, .error-state { text-align: center; padding: 60px 20px; color: #999; }
.error-state a { color: #1a73e8; }

.detail-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 32px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  align-items: start;
}

.detail-gallery {
  position: sticky;
  top: 20px;
}

.no-image-placeholder {
  width: 100%; aspect-ratio: 16/10;
  background: #f5f5f5; border-radius: 12px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #999; gap: 8px;
}
.placeholder-icon { font-size: 48px; }
.placeholder-text { font-size: 14px; }

.detail-content {
  min-width: 0;
}

.btn-back {
  background: none; border: none; color: #1a73e8; font-size: 14px;
  cursor: pointer; margin-bottom: 12px; padding: 0;
}

.post-header { margin-bottom: 12px; }
.type-badge { background: #e8f0fe; color: #1a73e8; padding: 4px 10px; border-radius: 4px; font-size: 12px; }
.post-title { font-size: 24px; font-weight: 700; color: #202124; margin: 0 0 12px 0; line-height: 1.3; }

.post-meta { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #5f6368; margin-bottom: 12px; flex-wrap: wrap; }
.author-link { cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: background 0.15s; color: #1a73e8; font-weight: 500; }
.author-link:hover { background: #e8f0fe; }
.meta-sep { color: #dadce0; }

.post-stats { display: flex; gap: 16px; font-size: 13px; color: #5f6368; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #f1f3f4; }

.post-tags { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.tag-pill { background: #f1f3f4; color: #5f6368; padding: 4px 12px; border-radius: 12px; font-size: 13px; }

.post-body { font-size: 15px; line-height: 1.8; color: #333; margin-bottom: 24px; }
.post-body p { margin: 0 0 12px 0; }

.action-bar { display: flex; gap: 8px; padding-top: 16px; border-top: 1px solid #e8eaed; align-items: center; flex-wrap: wrap; margin-bottom: 24px; }
.action-btn { padding: 6px 14px; border: 1px solid #dadce0; background: #fff; border-radius: 6px; cursor: pointer; font-size: 13px; color: #333; }
.action-btn:hover { background: #f8f9fa; border-color: #d2e3fc; color: #1a73e8; }
.action-btn.btn-danger { color: #d93025; border-color: #f28b82; }
.action-btn.btn-danger:hover { background: #fce8e6; color: #c5221f; border-color: #f28b82; }
.react-btn.liked { background: #e6f4ea; color: #137333; border-color: #ceead6; }
.react-btn.disliked { background: #fce8e6; color: #c5221f; border-color: #f28b82; }
.action-spacer { flex: 1; }
.action-btn.btn-admin-danger { color: #fff; background: #d93025; border-color: #d93025; font-weight: 600; }
.action-btn.btn-admin-danger:hover { background: #c5221f; border-color: #c5221f; }

@media (max-width: 860px) {
  .detail-layout { grid-template-columns: 1fr; }
  .detail-gallery { position: static; }
}
</style>
