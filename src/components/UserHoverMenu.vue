<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFriendStore } from '@/stores/friend'
import { useUserStore } from '@/stores/user'
import http from '@/api/http'
import type { FriendshipStatus } from '@/types'

const props = defineProps<{
  userId: number
  source: string
  sourceId?: number
  triggerEl: HTMLElement
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const router = useRouter()
const friendStore = useFriendStore()
const userStore = useUserStore()

const status = ref<FriendshipStatus>({ status: 'NONE' })
const username = ref('')
const rect = props.triggerEl.getBoundingClientRect()

const posX = ref(Math.min(rect.left, window.innerWidth - 220))
const posY = ref(rect.bottom + 4)

onMounted(async () => {
  status.value = await friendStore.checkStatus(props.userId)
  try {
    const res = await http.get(`/users/${props.userId}/profile`)
    username.value = res.data?.user?.username || ''
  } catch { /* */ }
})

function goToProfile() {
  emit('close')
  router.push(`/mine?userId=${props.userId}`)
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
</script>

<template>
  <div class="hover-backdrop" @click.self="emit('close')">
    <div
      class="hover-menu"
      :style="{ left: posX + 'px', top: posY + 'px' }"
    >
      <div class="hover-user-info">
        <div class="hover-avatar">{{ username.charAt(0) || '?' }}</div>
        <span class="hover-username">{{ username || '用户' + userId }}</span>
      </div>
      <div class="hover-actions">
        <button
          v-if="!isSelf()"
          class="hover-action-btn"
          @click="goToChat"
        >
          💬 私聊
        </button>
        <button
          v-if="!isSelf() && status.status === 'NONE'"
          class="hover-action-btn"
          @click="handleAddFriend"
        >
          ➕ 加好友
        </button>
        <span
          v-else-if="!isSelf() && status.status === 'FRIEND'"
          class="hover-badge friend-badge"
        >
          ✅ 好友
        </span>
        <span
          v-else-if="!isSelf() && status.status === 'PENDING_TO_THEM'"
          class="hover-badge pending-badge"
        >
          ⏳ 已申请
        </span>
        <span
          v-else-if="!isSelf() && status.status === 'PENDING_FROM_THEM'"
          class="hover-badge pending-badge"
        >
          📩 待回复
        </span>
        <button class="hover-action-btn" @click="goToProfile">
          👤 个人主页
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hover-backdrop {
  position: fixed; inset: 0; z-index: 1000;
}
.hover-menu {
  position: fixed;
  z-index: 1001;
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 12px;
  padding: 16px;
  min-width: 180px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
.hover-user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f3f4;
}
.hover-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: #1a73e8;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
}
.hover-username {
  font-weight: 600;
  color: #202124;
  font-size: 14px;
}
.hover-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  color: #5f6368;
}
.friend-badge { color: #137333; }
.pending-badge { color: #f9ab00; }
</style>
