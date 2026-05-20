import { defineStore } from 'pinia'
import { ref } from 'vue'
import http from '@/api/http'
import type { PrivateMessage, UserVO } from '@/types'

export const useChatStore = defineStore('chat', () => {
  const partners = ref<UserVO[]>([])
  const activeUserId = ref<number | null>(null)
  const messages = ref<PrivateMessage[]>([])
  const unreadCount = ref(0)

  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function loadPartners() {
    try {
      const res = await http.get<UserVO[]>('/chat')
      partners.value = res.data || []
    } catch { /* silent */ }
  }

  async function startChat(userId: number) {
    activeUserId.value = userId
    messages.value = []
    await loadMessages(userId)
    startPolling(userId)
  }

  async function loadMessages(targetUserId: number, since?: number) {
    try {
      const params: any = {}
      if (since) params.since = since
      const res = await http.get<PrivateMessage[]>(`/chat/${targetUserId}`, { params })
      if (since) {
        messages.value.push(...(res.data || []))
      } else {
        messages.value = res.data || []
      }
    } catch { /* silent */ }
  }

  async function sendMessage(body: string, imageUrl?: string) {
    if (!activeUserId.value) return
    try {
      const payload: any = { body }
      if (imageUrl) payload.imageUrl = imageUrl
      const res = await http.post<PrivateMessage>(`/chat/${activeUserId.value}`, payload)
      messages.value.push(res.data)
    } catch { /* silent */ }
  }

  function startPolling(targetUserId: number) {
    stopPolling()
    pollTimer = setInterval(async () => {
      if (messages.value.length > 0) {
        const lastId = messages.value[messages.value.length - 1].id
        await loadMessages(targetUserId, lastId)
      } else {
        await loadMessages(targetUserId)
      }
    }, 3000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  async function loadUnreadCount() {
    try {
      const res = await http.get<number>('/chat/unread-count')
      unreadCount.value = res.data ?? 0
    } catch { /* silent */ }
  }

  function closeChat() {
    stopPolling()
    activeUserId.value = null
    messages.value = []
  }

  return {
    partners, activeUserId, messages, unreadCount,
    loadPartners, startChat, loadMessages, sendMessage,
    startPolling, stopPolling, loadUnreadCount, closeChat,
  }
})
