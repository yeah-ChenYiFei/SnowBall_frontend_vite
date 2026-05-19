<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useFriendStore } from '@/stores/friend'
import { useUserStore } from '@/stores/user'
import http from '@/api/http'
import type { Friend, PrivateMessage } from '@/types'

const router = useRouter()
const friendStore = useFriendStore()
const userStore = useUserStore()

const tab = ref<'friends' | 'pending'>('friends')
const selectedFriend = ref<Friend | null>(null)
const messages = ref<PrivateMessage[]>([])
const newMsg = ref('')
const isLoadingMsgs = ref(false)
const chatRef = ref<HTMLElement | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

function loadFriends() {
  friendStore.loadFriends()
  friendStore.loadPendingRequests()
}

async function loadMessages(friendId: number) {
  isLoadingMsgs.value = true
  try {
    const res = await http.get(`/chat/${friendId}`)
    messages.value = Array.isArray(res.data) ? res.data : (res.data?.messages || [])
    await nextTick()
    scrollToBottom()
  } catch {
    messages.value = []
  } finally {
    isLoadingMsgs.value = false
  }
}

function selectFriend(f: Friend) {
  selectedFriend.value = f
  loadMessages(f.userId)
}

function scrollToBottom() {
  if (chatRef.value) {
    chatRef.value.scrollTop = chatRef.value.scrollHeight
  }
}

async function sendMessage() {
  const body = newMsg.value.trim()
  if (!body || !selectedFriend.value) return
  try {
    await http.post(`/chat/${selectedFriend.value.userId}`, { body })
    newMsg.value = ''
    loadMessages(selectedFriend.value.userId)
  } catch (e: any) {
    alert(e.message || '发送失败')
  }
}

function goToProfile(userId: number) {
  router.push(`/profile/${userId}`)
}

async function handleAccept(friend: Friend) {
  await friendStore.acceptRequest(friend.id || friend.userId)
  loadFriends()
}

async function handleReject(friend: Friend) {
  await friendStore.rejectRequest(friend.id || friend.userId)
  loadFriends()
}

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  loadFriends()
  pollTimer = setInterval(() => {
    if (selectedFriend.value) {
      loadMessages(selectedFriend.value.userId)
    }
  }, 5000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="friends-page">
    <!-- Left: Friend List -->
    <aside class="friends-left">
      <div class="friends-left-header">
        <h2>我的好友</h2>
      </div>

      <div class="friends-tabs">
        <button :class="['tab-btn', { active: tab === 'friends' }]" @click="tab = 'friends'">
          好友 ({{ friendStore.friends.length }})
        </button>
        <button :class="['tab-btn', { active: tab === 'pending' }]" @click="tab = 'pending'">
          待处理
          <span v-if="friendStore.pendingRequests.length" class="badge">{{ friendStore.pendingRequests.length }}</span>
        </button>
      </div>

      <!-- Friends List -->
      <div v-if="tab === 'friends'" class="friends-list">
        <div v-if="friendStore.friends.length === 0" class="empty-hint">还没有好友</div>
        <div
          v-for="f in friendStore.friends"
          :key="f.userId"
          class="friend-item"
          :class="{ 'friend-selected': selectedFriend?.userId === f.userId }"
          @click="selectFriend(f)"
        >
          <div class="friend-avatar-sm">{{ f.username?.charAt(0) || '?' }}</div>
          <div class="friend-item-info">
            <span class="friend-name">{{ f.username }}</span>
            <span class="friend-since">好友始于 {{ new Date(f.since).toLocaleDateString('zh-CN') }}</span>
          </div>
          <button class="btn-profile-sm" @click.stop="goToProfile(f.userId)" title="查看主页">👤</button>
        </div>
      </div>

      <!-- Pending Requests -->
      <div v-else class="friends-list">
        <div v-if="friendStore.pendingRequests.length === 0" class="empty-hint">没有待处理的好友请求</div>
        <div v-for="f in friendStore.pendingRequests" :key="f.userId" class="request-item">
          <div class="friend-avatar-sm">{{ f.username?.charAt(0) || '?' }}</div>
          <div class="friend-item-info">
            <span class="friend-name">{{ f.username }}</span>
            <span class="friend-since">请求添加你为好友</span>
          </div>
          <div class="request-actions">
            <button class="btn-accept" @click="handleAccept(f)">同意</button>
            <button class="btn-reject" @click="handleReject(f)">拒绝</button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Right: Chat Area -->
    <div class="friends-right">
      <template v-if="selectedFriend">
        <div class="chat-header">
          <div class="chat-friend-info" @click="goToProfile(selectedFriend.userId)">
            <div class="friend-avatar-sm">{{ selectedFriend.username?.charAt(0) || '?' }}</div>
            <span class="chat-friend-name">{{ selectedFriend.username }}</span>
          </div>
        </div>
        <div ref="chatRef" class="chat-messages">
          <div v-if="isLoadingMsgs" class="chat-loading">加载中...</div>
          <div v-else-if="messages.length === 0" class="chat-empty">暂无消息，开始聊天吧</div>
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="msg-bubble"
            :class="{ 'msg-mine': msg.senderId === userStore.userInfo?.id }"
          >
            <div class="msg-text">{{ msg.body }}</div>
            <div class="msg-time">{{ formatTime(msg.createdAt) }}</div>
          </div>
        </div>
        <div class="chat-input-area">
          <input
            v-model="newMsg"
            type="text"
            class="chat-input"
            placeholder="输入消息..."
            @keyup.enter="sendMessage"
          />
          <button class="btn-send" @click="sendMessage">发送</button>
        </div>
      </template>
      <template v-else>
        <div class="no-friend-selected">
          <div class="no-select-icon">💬</div>
          <p>点击左侧好友开始聊天</p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.friends-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 0;
  height: calc(100vh - 64px - 64px);
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  overflow: hidden;
}

/* ===== Left ===== */
.friends-left {
  border-right: 1px solid #e8eaed;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.friends-left-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 12px;
}
.friends-left-header h2 { margin: 0; font-size: 18px; font-weight: 600; color: #202124; }

.friends-tabs {
  display: flex;
  padding: 0 16px 12px;
  border-bottom: 1px solid #e8eaed;
}
.tab-btn {
  flex: 1; padding: 8px 0; background: none; border: none;
  border-bottom: 2px solid transparent; font-size: 13px; color: #5f6368; cursor: pointer;
}
.tab-btn.active { color: #1a73e8; border-bottom-color: #1a73e8; font-weight: 600; }
.badge {
  background: #ea4335; color: #fff; border-radius: 10px;
  padding: 1px 5px; font-size: 11px; margin-left: 4px;
}

.friends-list { flex: 1; overflow-y: auto; padding: 8px; }
.empty-hint { text-align: center; color: #999; font-size: 13px; padding: 32px 0; }

.friend-item, .request-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: background 0.1s;
}
.friend-item:hover, .request-item:hover { background: #f8f9fa; }
.friend-item.friend-selected { background: #e8f0fe; border: 1px solid #d2e3fc; }

.friend-avatar-sm {
  width: 36px; height: 36px; border-radius: 50%;
  background: #1a73e8; color: #fff; display: flex;
  align-items: center; justify-content: center;
  font-weight: 600; font-size: 15px; flex-shrink: 0;
}
.friend-item-info { flex: 1; min-width: 0; }
.friend-name { font-size: 14px; color: #202124; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.friend-since { font-size: 12px; color: #999; }
.btn-profile-sm {
  background: none; border: 1px solid #dadce0; border-radius: 4px;
  cursor: pointer; font-size: 14px; padding: 4px 8px; flex-shrink: 0;
}
.btn-profile-sm:hover { background: #e8f0fe; border-color: #1a73e8; }

.request-actions { display: flex; gap: 6px; flex-shrink: 0; }
.btn-accept { padding: 4px 10px; background: #1a73e8; color: #fff; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; }
.btn-accept:hover { background: #1557b0; }
.btn-reject { padding: 4px 10px; background: #fff; color: #d93025; border: 1px solid #f28b82; border-radius: 5px; cursor: pointer; font-size: 12px; }
.btn-reject:hover { background: #fce8e6; }

/* ===== Right: Chat ===== */
.friends-right { display: flex; flex-direction: column; overflow: hidden; background: #f8f9fa; }

.chat-header { padding: 14px 20px; border-bottom: 1px solid #e8eaed; background: #fff; }
.chat-friend-info { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.chat-friend-info:hover .chat-friend-name { color: #1a73e8; }
.chat-friend-name { font-size: 15px; font-weight: 600; color: #202124; }

.chat-messages {
  flex: 1; overflow-y: auto; padding: 16px 20px;
  display: flex; flex-direction: column; gap: 8px;
}
.chat-loading, .chat-empty { text-align: center; color: #999; font-size: 13px; margin: auto; }

.msg-bubble { max-width: 65%; align-self: flex-start; }
.msg-bubble.msg-mine { align-self: flex-end; }
.msg-text {
  padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.5;
  background: #fff; color: #202124; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.msg-mine .msg-text { background: #1a73e8; color: #fff; }
.msg-time { font-size: 11px; color: #999; margin-top: 2px; padding: 0 4px; }
.msg-mine .msg-time { text-align: right; }

.chat-input-area { display: flex; gap: 10px; padding: 14px 20px; border-top: 1px solid #e8eaed; background: #fff; }
.chat-input {
  flex: 1; padding: 10px 14px; border: 1px solid #dadce0;
  border-radius: 20px; font-size: 14px; outline: none; font-family: inherit;
}
.chat-input:focus { border-color: #1a73e8; }
.btn-send {
  padding: 10px 20px; background: #1a73e8; color: #fff;
  border: none; border-radius: 20px; font-size: 14px; cursor: pointer; font-weight: 500;
}
.btn-send:hover { background: #1557b0; }

.no-friend-selected { margin: auto; text-align: center; color: #999; }
.no-select-icon { font-size: 48px; margin-bottom: 12px; }
.no-friend-selected p { font-size: 14px; margin: 0; }
</style>
