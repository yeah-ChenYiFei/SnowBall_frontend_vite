<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import http from '@/api/http'
import { useFriendStore } from '@/stores/friend'
import type { Notification } from '@/types'

const router = useRouter()
const friendStore = useFriendStore()
const notifications = ref<Notification[]>([])
const isLoading = ref(false)
const unreadCount = ref(0)
const processedIds = ref<Set<number>>(new Set())

const loadNotifications = async () => {
  isLoading.value = true
  try {
    const res = await http.get('/notifications')
    notifications.value = (res.data || []) as Notification[]
    unreadCount.value = notifications.value.filter(n => !n.isRead).length
  } catch (e: any) {
    console.error('加载通知失败', e)
  } finally {
    isLoading.value = false
  }
}

const markRead = async (id: number) => {
  try {
    await http.put(`/notifications/${id}/read`)
    const n = notifications.value.find(x => x.id === id)
    if (n && !n.isRead) {
      n.isRead = true
      unreadCount.value--
    }
  } catch (e: any) {
    console.error(e)
  }
}

const markAllRead = async () => {
  try {
    await http.put('/notifications/read-all')
    notifications.value.forEach(n => n.isRead = true)
    unreadCount.value = 0
  } catch (e: any) {
    console.error(e)
  }
}

const handleClick = (n: Notification) => {
  markRead(n.id)
  if (n.type === 'FRIEND_REQUEST') return // Don't navigate for friend requests
  if (n.sourceType === 'POST' && n.sourceId) {
    router.push(`/post/${n.sourceId}`)
  } else if (n.sourceType === 'WORLD' && n.sourceId) {
    router.push(`/create/setting/${n.sourceId}`)
  }
}

async function handleAcceptFriend(n: Notification) {
  await markRead(n.id)
  await friendStore.acceptRequest(n.sourceId)
  processedIds.value.add(n.id)
}

async function handleRejectFriend(n: Notification) {
  await markRead(n.id)
  await friendStore.rejectRequest(n.sourceId)
  processedIds.value.add(n.id)
}

const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    COMMENT: '评论',
    REPLY: '回复',
    LIKE_POST: '赞了帖子',
    LIKE_COMMENT: '赞了评论',
    FRIEND_REQUEST: '好友请求',
    FRIEND_ACCEPTED: '已接受好友',
    WORLD_COLLABORATOR_ADDED: '共创邀请',
    WORLD_COLLABORATOR_CHANGE: '共创修改',
    WORLD_CHANGE_APPROVED: '已通过',
    WORLD_CHANGE_REJECTED: '已拒绝',
  }
  return map[type] || type
}

onMounted(() => loadNotifications())
</script>

<template>
  <div class="notifications-page">
    <div class="page-header">
      <h1>通知</h1>
      <button
        v-if="unreadCount > 0"
        class="btn-mark-all"
        @click="markAllRead"
      >
        全部已读
      </button>
    </div>

    <div v-if="isLoading" class="loading">加载中...</div>

    <div v-else-if="notifications.length === 0" class="empty">
      暂无通知
    </div>

    <div v-else class="notification-list">
      <div
        v-for="n in notifications"
        :key="n.id"
        class="notification-item"
        :class="{ unread: !n.isRead }"
        @click="handleClick(n)"
      >
        <div class="notif-dot" v-if="!n.isRead"></div>
        <div class="notif-body">
          <span class="notif-actor">{{ n.actorName }}</span>
          <span class="notif-type">{{ typeLabel(n.type) }}</span>
          <span class="notif-text">{{ n.body }}</span>
        </div>
        <div class="notif-actions" v-if="n.type === 'FRIEND_REQUEST' && !processedIds.has(n.id)" @click.stop>
          <button class="btn-notif-accept" @click="handleAcceptFriend(n)">同意</button>
          <button class="btn-notif-reject" @click="handleRejectFriend(n)">拒绝</button>
        </div>
        <div class="notif-actions" v-else-if="n.type === 'FRIEND_REQUEST' && processedIds.has(n.id)" @click.stop>
          <span class="processed-text">您已通过/拒绝</span>
        </div>
        <div class="notif-time">{{ new Date(n.createdAt).toLocaleString() }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notifications-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 40px 20px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.page-header h1 {
  margin: 0;
  font-size: 24px;
  color: #202124;
}
.btn-mark-all {
  padding: 6px 16px;
  background: #e8f0fe;
  color: #1a73e8;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.btn-mark-all:hover { background: #d2e3fc; }
.loading, .empty { text-align: center; padding: 60px; color: #999; }
.notification-list { display: flex; flex-direction: column; gap: 4px; }
.notification-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  border: 1px solid #e8eaed;
}
.notification-item:hover { background: #f8f9fa; }
.notification-item.unread { background: #e8f0fe; border-color: #c6dafc; }
.notif-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1a73e8;
  flex-shrink: 0;
}
.notif-body {
  flex: 1;
  font-size: 14px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notif-actor { font-weight: 600; color: #1a73e8; margin-right: 4px; }
.notif-type { color: #5f6368; margin-right: 4px; font-size: 13px; }
.notif-text { color: #333; }
.notif-time { font-size: 12px; color: #999; flex-shrink: 0; }
.notif-actions { display: flex; gap: 6px; flex-shrink: 0; margin-right: 8px; }
.btn-notif-accept {
  padding: 4px 12px; background: #1a73e8; color: #fff;
  border: none; border-radius: 4px; cursor: pointer; font-size: 12px;
}
.btn-notif-accept:hover { background: #1557b0; }
.btn-notif-reject {
  padding: 4px 12px; background: #fff; color: #d93025;
  border: 1px solid #f28b82; border-radius: 4px; cursor: pointer; font-size: 12px;
}
.btn-notif-reject:hover { background: #fce8e6; }
.processed-text { font-size: 12px; color: #999; }
</style>
