<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import type { Post, Inspiration } from '@/types'
import UserHoverMenu from '@/components/UserHoverMenu.vue'
import CreatePostModal from '@/components/CreatePostModal.vue'

const router = useRouter()
const userStore = useUserStore()

// Hover menu state
const hoverUserId = ref(0)
const hoverEl = ref<HTMLElement | null>(null)
const showHoverMenu = ref(false)
let hoverTimer: ReturnType<typeof setTimeout> | null = null

function onAuthorEnter(e: MouseEvent, userId: number) {
  if (hoverTimer) clearTimeout(hoverTimer)
  hoverUserId.value = userId
  hoverEl.value = e.currentTarget as HTMLElement
  showHoverMenu.value = true
}
function onAuthorLeave() {
  hoverTimer = setTimeout(() => { showHoverMenu.value = false }, 300)
}

const posts = ref<Post[]>([])
const isLoadingPosts = ref(false)
const showCreatePost = ref(false)

const diaryStreak = ref(0)
const isLoadingStreak = ref(false)

const inspirations = ref<Inspiration[]>([])
const isLoadingInspirations = ref(false)

// Load THOUGHT-type posts only
const loadPosts = async () => {
  isLoadingPosts.value = true
  try {
    const res = await http.get('/posts')
    posts.value = (res.data || [])
      .filter((p: Post) => p.type === 'THOUGHT')
      .sort((a: Post, b: Post) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
  } catch {
    // silent
  } finally {
    isLoadingPosts.value = false
  }
}

// Load diary streak
const loadStreak = async () => {
  if (!userStore.isLogin()) return
  isLoadingStreak.value = true
  try {
    const res = await http.get('/articles/diary-streak')
    diaryStreak.value = res.data ?? 0
  } catch {
    diaryStreak.value = 0
  } finally {
    isLoadingStreak.value = false
  }
}

// Load recent inspirations
const loadInspirations = async () => {
  if (!userStore.isLogin()) return
  isLoadingInspirations.value = true
  try {
    const res = await http.get('/inspirations')
    inspirations.value = (res.data || []).slice(0, 5)
  } catch {
    // silent
  } finally {
    isLoadingInspirations.value = false
  }
}

const goToPost = (id: number) => {
  router.push(`/post/${id}`)
}

const goToDiary = () => {
  router.push('/writing/new?type=DIARY')
}

const goToInspiration = () => {
  router.push('/create/inspiration')
}

const onPostCreated = (post: Post) => {
  posts.value.unshift(post)
}

const handleReact = async (post: Post, type: 'LIKE' | 'DISLIKE', event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  try {
    await http.post(`/posts/${post.id}/react`, null, { params: { reactionType: type } })
    if (post.currentUserReaction === type) {
      post.currentUserReaction = null
      if (type === 'LIKE') post.likeCount = (post.likeCount || 0) - 1
      else post.dislikeCount = (post.dislikeCount || 0) - 1
    } else {
      if (post.currentUserReaction === 'LIKE') post.likeCount = (post.likeCount || 0) - 1
      if (post.currentUserReaction === 'DISLIKE') post.dislikeCount = (post.dislikeCount || 0) - 1
      post.currentUserReaction = type
      if (type === 'LIKE') post.likeCount = (post.likeCount || 0) + 1
      else post.dislikeCount = (post.dislikeCount || 0) + 1
    }
  } catch {
    // silent
  }
}

const formatDate = (iso: string) => {
  return new Date(iso).toLocaleDateString('zh-CN')
}

const truncateText = (text: string, max: number) => {
  return text.length > max ? text.substring(0, max) + '...' : text
}

onMounted(() => {
  loadPosts()
  loadStreak()
  loadInspirations()
})
</script>

<template>
  <div class="plaza-layout">
    <!-- ===== LEFT: Post Feed (2/3) ===== -->
    <div class="plaza-left">
      <div class="feed-header">
        <div>
          <h2 class="feed-title">广场</h2>
          <span class="feed-subtitle">零散想法，随时分享</span>
        </div>
        <button
          v-if="userStore.isLogin()"
          class="btn-create-post"
          @click="showCreatePost = true"
        >
          ✍️ 发帖
        </button>
      </div>

      <div v-if="isLoadingPosts" class="loading-state">加载中...</div>

      <div v-else-if="posts.length === 0" class="empty-state">
        <div class="empty-icon">💭</div>
        <div class="empty-text">还没有帖子，来发表第一个想法吧</div>
      </div>

      <div v-else class="post-feed">
        <article
          v-for="post in posts"
          :key="post.id"
          class="post-card"
          @click="goToPost(post.id)"
        >
          <div class="card-meta-top">
            <span class="post-date">{{ formatDate(post.createdAt) }}</span>
          </div>

          <h3 class="card-title">{{ post.title }}</h3>
          <p class="card-content">{{ truncateText(post.body || '', 200) }}</p>

          <div class="card-footer">
            <span
              class="footer-author"
              @mouseenter.stop="onAuthorEnter($event, post.userId)"
              @mouseleave="onAuthorLeave"
            >👤 {{ post.authorName || '匿名' }}</span>
            <div class="footer-stats">
              <span class="stat-item">👁️ {{ post.viewCount || 0 }}</span>
              <button
                class="stat-item stat-btn"
                :class="{ active: post.currentUserReaction === 'LIKE' }"
                @click="handleReact(post, 'LIKE', $event)"
              >
                👍 {{ post.likeCount || 0 }}
              </button>
              <button
                class="stat-item stat-btn"
                :class="{ active: post.currentUserReaction === 'DISLIKE' }"
                @click="handleReact(post, 'DISLIKE', $event)"
              >
                👎 {{ post.dislikeCount || 0 }}
              </button>
              <span class="stat-item">💬 {{ post.commentCount || 0 }}</span>
            </div>
          </div>
        </article>
      </div>
    </div>

    <!-- ===== RIGHT: Sidebar (1/3) ===== -->
    <aside class="plaza-right">
      <!-- Diary Streak Card -->
      <div class="sidebar-card streak-card">
        <div class="streak-header">您已经连续写日记</div>
        <div class="streak-number">{{ isLoadingStreak ? '...' : diaryStreak }}</div>
        <div class="streak-unit">天</div>
        <button class="streak-btn" @click="goToDiary">
          ✍️ 写日记
        </button>
      </div>

      <!-- Inspiration Card -->
      <div class="sidebar-card inspiration-card">
        <h3 class="card-header">
          <span>💡 灵感区</span>
        </h3>

        <div v-if="!userStore.isLogin()" class="insp-login-hint">
          登录后查看灵感
        </div>
        <div v-else-if="isLoadingInspirations" class="insp-loading">
          加载中...
        </div>
        <div v-else-if="inspirations.length === 0" class="insp-empty">
          暂无灵感记录
        </div>
        <ul v-else class="insp-list">
          <li
            v-for="insp in inspirations"
            :key="insp.id"
            class="insp-item"
          >
            <p class="insp-text">{{ truncateText(insp.content, 60) }}</p>
            <span class="insp-time">{{ formatDate(insp.createdAt) }}</span>
          </li>
        </ul>

        <button class="insp-btn" @click="goToInspiration">
          💭 写灵感
        </button>
      </div>
    </aside>

    <!-- Hover menu -->
    <UserHoverMenu
      v-if="showHoverMenu && hoverEl && hoverUserId"
      :user-id="hoverUserId"
      source="POST"
      :trigger-el="hoverEl"
      @close="showHoverMenu = false"
      @cancelClose="if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }"
    />

    <!-- Create Post Modal -->
    <CreatePostModal
      v-if="showCreatePost"
      @close="showCreatePost = false"
      @created="onPostCreated"
    />
  </div>
</template>

<style scoped>
/* ===== Layout ===== */
.plaza-layout {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 24px;
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 28px;
  align-items: start;
}

/* ===== LEFT: Feed ===== */
.plaza-left {
  min-width: 0;
}

.feed-header {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.feed-title {
  font-size: 22px;
  font-weight: 700;
  color: #202124;
  margin: 0;
}

.feed-subtitle {
  font-size: 13px;
  color: #999;
  display: block;
  margin-top: 2px;
}

.btn-create-post {
  padding: 10px 22px;
  background: #1a73e8;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.btn-create-post:hover {
  background: #1557b0;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(26,115,232,0.3);
}

.loading-state {
  text-align: center;
  padding: 60px;
  color: #999;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
  background: #fff;
  border-radius: 12px;
}
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.empty-text { font-size: 14px; }

/* Post Cards */
.post-feed {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.post-card {
  background: #fff;
  padding: 20px 24px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid #f1f3f4;
}

.post-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.08);
  border-color: #e8eaed;
}

.card-meta-top {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 6px;
}

.post-date {
  font-size: 13px;
  color: #999;
}

.card-title {
  font-size: 17px;
  font-weight: 600;
  color: #202124;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.card-content {
  font-size: 14px;
  color: #5f6368;
  line-height: 1.6;
  margin: 0 0 14px 0;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.footer-author {
  color: #5f6368;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s;
}
.footer-author:hover {
  background: #e8f0fe;
  color: #1a73e8;
}

.footer-stats {
  display: flex;
  gap: 12px;
  align-items: center;
}

.stat-item {
  color: #999;
  font-size: 13px;
}

.stat-btn {
  background: none;
  border: 1px solid #e8eaed;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 13px;
  cursor: pointer;
  color: #5f6368;
  transition: all 0.2s;
}

.stat-btn:hover {
  background: #f1f3f4;
}

.stat-btn.active {
  color: #137333;
  background: #e6f4ea;
  border-color: #ceead6;
}
.stat-btn:last-child.active {
  color: #c5221f;
  background: #fce8e6;
  border-color: #f28b82;
}

/* ===== RIGHT: Sidebar ===== */
.plaza-right {
  position: sticky;
  top: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sidebar-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border: 1px solid #f1f3f4;
}

/* Diary Streak */
.streak-card {
  text-align: center;
}

.streak-header {
  font-size: 14px;
  color: #5f6368;
  margin-bottom: 8px;
}

.streak-number {
  font-size: 64px;
  font-weight: 800;
  color: #1a73e8;
  line-height: 1;
  margin-bottom: 4px;
}

.streak-unit {
  font-size: 16px;
  color: #5f6368;
  margin-bottom: 20px;
}

.streak-btn {
  width: 100%;
  padding: 12px 0;
  background: #1a73e8;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.streak-btn:hover {
  background: #1557b0;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(26,115,232,0.3);
}

/* Inspiration */
.inspiration-card .card-header {
  font-size: 16px;
  font-weight: 600;
  color: #202124;
  margin: 0 0 16px 0;
}

.insp-login-hint,
.insp-loading,
.insp-empty {
  text-align: center;
  color: #999;
  font-size: 14px;
  padding: 20px 0;
}

.insp-list {
  list-style: none;
  padding: 0;
  margin: 0 0 16px 0;
}

.insp-item {
  padding: 10px 0;
  border-bottom: 1px solid #f1f3f4;
}

.insp-item:last-child {
  border-bottom: none;
}

.insp-text {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
  margin: 0 0 4px 0;
}

.insp-time {
  font-size: 12px;
  color: #999;
}

.insp-btn {
  width: 100%;
  padding: 10px 0;
  background: #fff;
  color: #1a73e8;
  border: 1px solid #1a73e8;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.insp-btn:hover {
  background: #e8f0fe;
}

/* ===== Responsive ===== */
@media (max-width: 860px) {
  .plaza-layout {
    grid-template-columns: 1fr;
    padding: 16px;
  }
  .plaza-right {
    position: static;
  }
}
</style>
