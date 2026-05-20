<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFriendStore } from '@/stores/friend'
import { useUserStore } from '@/stores/user'
import http from '@/api/http'
import UserAvatar from '@/components/UserAvatar.vue'
import type { FriendshipStatus, Post } from '@/types'

const props = defineProps<{
  userId: number
  source: string
  sourceId?: number
  triggerEl: HTMLElement
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'cancelClose'): void
}>()

const router = useRouter()
const friendStore = useFriendStore()
const userStore = useUserStore()

const status = ref<FriendshipStatus>({ status: 'NONE' })
const username = ref('')
const avatarUrl = ref<string | null>(null)
const userRole = ref('')
const recentPosts = ref<Post[]>([])
const loaded = ref(false)
const rect = props.triggerEl.getBoundingClientRect()

const posX = ref(Math.min(rect.left, window.innerWidth - 260))
const posY = ref(rect.bottom - 2)

let closeTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  const [s, profileRes] = await Promise.all([
    friendStore.checkStatus(props.userId),
    http.get(`/users/${props.userId}/profile`).then(r => r.data).catch(() => null)
  ])
  status.value = s
  if (profileRes) {
    username.value = profileRes.user?.username || ''
    avatarUrl.value = profileRes.user?.avatarUrl || null
    userRole.value = profileRes.user?.role || ''
    recentPosts.value = (profileRes.posts || []).slice(0, 3)
  }
  loaded.value = true
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  if (closeTimer) clearTimeout(closeTimer)
})

function onClickOutside(e: MouseEvent) {
  // Don't close if clicking the trigger element
  if (props.triggerEl && props.triggerEl.contains(e.target as Node)) return
  emit('close')
}

function onCardEnter() {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
  emit('cancelClose')
}

function onCardLeave() {
  closeTimer = setTimeout(() => emit('close'), 500)
}

function goToProfile() {
  emit('close')
  router.push(`/profile/${props.userId}`)
}

function goToChat() {
  emit('close')
  router.push(`/chat/${props.userId}`)
}

function handleAddFriend() {
  friendStore.sendRequest(props.userId, props.source, props.sourceId)
  status.value = { status: 'PENDING_TO_THEM' }
}

const isSelf = () => userStore.userInfo?.id === props.userId

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('zh-CN')
</script>

<template>
  <div class="hover-backdrop">
    <div
      class="hover-menu"
      :style="{ left: posX + 'px', top: posY + 'px' }"
      @mouseenter="onCardEnter"
      @mouseleave="onCardLeave"
    >
      <div v-if="!loaded" class="hover-loading">加载中...</div>
      <template v-else>
        <div class="hover-user-info">
          <UserAvatar :username="username" :avatar-url="avatarUrl" :size="44" class="hover-avatar" />
          <div class="hover-user-text">
            <span class="hover-username">{{ username || '用户' + userId }}</span>
            <span v-if="userRole" class="hover-role">{{ userRole }}</span>
          </div>
        </div>

        <div v-if="!isSelf()" class="hover-actions">
          <button class="hover-action-btn" @click="goToProfile">👤 个人主页</button>
          <button class="hover-action-btn" @click="goToChat">💬 私聊</button>
          <button
            v-if="status.status === 'NONE'"
            class="hover-action-btn"
            @click="handleAddFriend"
          >➕ 加好友</button>
          <span v-else-if="status.status === 'FRIEND'" class="hover-badge friend-badge">✅ 已加好友</span>
          <span v-else-if="status.status === 'PENDING_TO_THEM'" class="hover-badge pending-badge">⏳ 已申请</span>
          <span v-else-if="status.status === 'PENDING_FROM_THEM'" class="hover-badge pending-badge">📩 待回复</span>
        </div>

        <div v-if="recentPosts.length > 0" class="hover-posts-section">
          <div class="hover-section-title">最近帖子</div>
          <div
            v-for="post in recentPosts"
            :key="post.id"
            class="hover-post-item"
            @click="router.push(`/post/${post.id}`); emit('close')"
          >
            <span class="hover-post-title">{{ post.title }}</span>
            <span class="hover-post-date">{{ formatDate(post.createdAt) }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.hover-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  pointer-events: none;  /* don't block mouse events on elements underneath */
}
.hover-menu {
  position: fixed;
  z-index: 1001;
  pointer-events: auto;  /* the card itself captures mouse events */
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 14px;
  padding: 18px;
  min-width: 220px;
  max-width: 260px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.14);
}
.hover-user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid #f1f3f4;
}
.hover-avatar {
  /* sizing handled by UserAvatar component */
}
.hover-user-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.hover-username {
  font-weight: 600;
  color: #202124;
  font-size: 15px;
}
.hover-role {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}
.hover-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}
.hover-action-btn {
  padding: 8px 12px;
  border: none;
  background: #f8f9fa;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: background 0.15s;
}
.hover-action-btn:hover {
  background: #e8f0fe;
  color: #1a73e8;
}
.hover-badge {
  padding: 8px 12px;
  font-size: 13px;
  border-radius: 6px;
}
.friend-badge { color: #137333; background: #e6f4ea; }
.pending-badge { color: #e37400; background: #fef7e0; }

.hover-loading {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 8px 0;
}

.hover-posts-section {
  border-top: 1px solid #f1f3f4;
  padding-top: 10px;
}
.hover-section-title {
  font-size: 12px;
  font-weight: 500;
  color: #999;
  margin-bottom: 6px;
}
.hover-post-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s;
  gap: 8px;
}
.hover-post-item:hover {
  background: #f8f9fa;
}
.hover-post-title {
  font-size: 13px;
  color: #202124;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hover-post-date {
  font-size: 11px;
  color: #999;
  flex-shrink: 0;
}
</style>
