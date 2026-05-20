<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useChatStore } from '@/stores/chat'
import http from '@/api/http'
import UserAvatar from '@/components/UserAvatar.vue'
import ImageUploadButton from '@/components/ImageUploadButton.vue'
import ImageLightbox from '@/components/ImageLightbox.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const chatStore = useChatStore()

const inputText = ref('')
const pendingImageUrl = ref('')
const lightboxUrl = ref('')
const showLightbox = ref(false)
const chatEl = ref<HTMLElement | null>(null)
const partnerName = ref('')
const isLoading = ref(false)

const activeId = computed(() => {
  const id = route.params.userId
  return id ? Number(id) : null
})

// Scroll to bottom on new messages
watch(() => chatStore.messages.length, () => {
  setTimeout(() => {
    if (chatEl.value) {
      chatEl.value.scrollTop = chatEl.value.scrollHeight
    }
  }, 50)
})

onMounted(async () => {
  if (!userStore.isLogin()) {
    router.push('/login')
    return
  }
  await chatStore.loadPartners()
  if (activeId.value) {
    await openChat(activeId.value)
  }
})

onUnmounted(() => {
  chatStore.closeChat()
})

async function openChat(userId: number) {
  isLoading.value = true
  try {
    const res = await http.get(`/users/${userId}/profile`)
    partnerName.value = res.data?.user?.username || '用户' + userId
  } catch {
    partnerName.value = '用户' + userId
  }
  router.push('/chat/' + userId)
  await chatStore.startChat(userId)
  isLoading.value = false

  setTimeout(() => {
    if (chatEl.value) {
      chatEl.value.scrollTop = chatEl.value.scrollHeight
    }
  }, 100)
}

function selectPartner(userId: number) {
  openChat(userId)
}

async function handleSend() {
  const body = inputText.value.trim()
  if (!body && !pendingImageUrl.value) return
  inputText.value = ''
  const imgUrl = pendingImageUrl.value
  pendingImageUrl.value = ''
  await chatStore.sendMessage(body || '[图片]', imgUrl || undefined)
  setTimeout(() => {
    if (chatEl.value) {
      chatEl.value.scrollTop = chatEl.value.scrollHeight
    }
  }, 50)
}

function onImageUploaded(url: string) {
  pendingImageUrl.value = url
  handleSend()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function goBack() {
  chatStore.closeChat()
  router.push('/chat')
  partnerName.value = ''
}
</script>

<template>
  <div class="chat-page">
    <!-- Sidebar: partners -->
    <aside class="chat-sidebar">
      <div class="sidebar-header">
        <h3>私聊</h3>
      </div>
      <div v-if="chatStore.partners.length === 0" class="no-partners">
        暂无聊天记录
      </div>
      <div
        v-for="p in chatStore.partners"
        :key="p.id"
        :class="['partner-item', { active: activeId === p.id }]"
        @click="selectPartner(p.id)"
      >
        <UserAvatar :username="p.username || '?'" :avatar-url="p.avatarUrl" :size="32" class="partner-avatar" />
        <span class="partner-name">{{ p.username }}</span>
      </div>
    </aside>

    <!-- Main chat area -->
    <main class="chat-main">
      <template v-if="activeId">
        <div class="chat-header">
          <button class="btn-back" @click="goBack">← 返回</button>
          <span class="chat-partner-name">{{ partnerName }}</span>
        </div>

        <div ref="chatEl" class="chat-messages">
          <div v-if="isLoading" class="loading-hint">加载中...</div>
          <div
            v-for="msg in chatStore.messages"
            :key="msg.id"
            :class="['message-item', { mine: msg.senderId === userStore.userInfo?.id }]"
          >
            <div class="message-bubble">
              <div class="msg-sender" v-if="msg.senderId !== userStore.userInfo?.id">
                {{ msg.senderName }}
              </div>
              <img v-if="msg.imageUrl" :src="msg.imageUrl" class="msg-image" @click="lightboxUrl = msg.imageUrl; showLightbox = true" />
              <div class="msg-body">{{ msg.body }}</div>
              <div class="msg-time">{{ new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</div>
            </div>
          </div>
          <div v-if="chatStore.messages.length === 0 && !isLoading" class="empty-chat">
            发送第一条消息吧！
          </div>
        </div>

        <div class="chat-input-bar">
          <textarea
            v-model="inputText"
            class="chat-input"
            placeholder="输入消息..."
            rows="2"
            @keydown="handleKeydown"
          ></textarea>
          <ImageUploadButton @uploaded="onImageUploaded" />
          <button class="btn-send" @click="handleSend" :disabled="!inputText.trim() && !pendingImageUrl">
            发送
          </button>
        </div>
      </template>
      <template v-else>
        <div class="no-chat-selected">
          <div class="no-chat-icon">💬</div>
          <p>选择一个对话开始私聊</p>
        </div>
      </template>
    </main>
    <ImageLightbox :visible="showLightbox" :image-url="lightboxUrl" @close="showLightbox = false" />
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  height: calc(100vh - 64px);
  max-width: 1000px;
  margin: 0 auto;
  background: #fff;
  border-left: 1px solid #e8eaed;
  border-right: 1px solid #e8eaed;
}

/* Sidebar */
.chat-sidebar {
  width: 240px;
  border-right: 1px solid #e8eaed;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e8eaed;
}
.sidebar-header h3 { margin: 0; font-size: 16px; color: #202124; }
.no-partners {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 14px;
}
.partner-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s;
}
.partner-item:hover { background: #f8f9fa; }
.partner-item.active { background: #e8f0fe; }
.partner-avatar {
  /* sizing handled by UserAvatar component */
}
.partner-name { font-size: 14px; color: #202124; }

/* Main */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid #e8eaed;
}
.btn-back {
  background: none; border: none; color: #1a73e8;
  cursor: pointer; font-size: 14px;
}
.chat-partner-name { font-weight: 600; font-size: 15px; color: #202124; }

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #fafafa;
}
.loading-hint, .empty-chat {
  text-align: center;
  color: #999;
  font-size: 14px;
  padding: 40px 0;
}
.message-item { display: flex; }
.message-item.mine { justify-content: flex-end; }
.message-bubble {
  max-width: 70%;
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 12px;
  padding: 10px 14px;
}
.message-item.mine .message-bubble {
  background: #e8f0fe;
  border-color: #d2e3fc;
}
.msg-sender {
  font-size: 12px;
  color: #1a73e8;
  font-weight: 600;
  margin-bottom: 4px;
}
.msg-body {
  font-size: 14px;
  line-height: 1.5;
  color: #333;
  word-break: break-word;
}
.msg-image {
  max-width: 240px; max-height: 200px; border-radius: 8px;
  cursor: pointer; object-fit: cover; display: block; margin-bottom: 4px;
}
.msg-time {
  font-size: 11px;
  color: #999;
  text-align: right;
  margin-top: 4px;
}

.chat-input-bar {
  display: flex;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid #e8eaed;
  align-items: flex-end;
}
.chat-input {
  flex: 1;
  border: 1px solid #dadce0;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  resize: none;
  outline: none;
  font-family: inherit;
  line-height: 1.5;
}
.chat-input:focus { border-color: #1a73e8; }
.btn-send {
  padding: 10px 24px;
  background: #1a73e8;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}
.btn-send:hover:not(:disabled) { background: #1557b0; }
.btn-send:disabled { opacity: 0.5; cursor: not-allowed; }

.no-chat-selected {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}
.no-chat-icon { font-size: 48px; margin-bottom: 12px; }
.no-chat-selected p { font-size: 15px; }
</style>
