<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFriendStore } from '@/stores/friend'
import type { Friend } from '@/types'

const router = useRouter()
const friendStore = useFriendStore()

const tab = ref<'friends' | 'pending'>('friends')

function loadFriends() {
  friendStore.loadFriends()
  friendStore.loadPendingRequests()
}

function selectFriend(f: Friend) {
  router.push(`/chat/${f.userId}`)
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

onMounted(() => {
  loadFriends()
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

    <!-- Right: Prompt -->
    <div class="friends-right">
      <div class="no-friend-selected">
        <div class="no-select-icon">💬</div>
        <p>点击左侧好友即可开始私聊</p>
      </div>
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

.friends-left-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #202124;
}

.friends-tabs {
  display: flex;
  padding: 0 16px 12px;
  gap: 0;
  border-bottom: 1px solid #e8eaed;
}

.tab-btn {
  flex: 1;
  padding: 8px 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 13px;
  color: #5f6368;
  cursor: pointer;
  position: relative;
}
.tab-btn.active {
  color: #1a73e8;
  border-bottom-color: #1a73e8;
  font-weight: 600;
}
.badge {
  background: #ea4335;
  color: #fff;
  border-radius: 10px;
  padding: 1px 5px;
  font-size: 11px;
  margin-left: 4px;
}

.friends-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-hint {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 32px 0;
}

.friend-item, .request-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}
.friend-item:hover, .request-item:hover { background: #f8f9fa; }

.friend-avatar-sm {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #1a73e8;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 15px;
  flex-shrink: 0;
}

.friend-item-info {
  flex: 1;
  min-width: 0;
}

.friend-name {
  font-size: 14px;
  color: #202124;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-since {
  font-size: 12px;
  color: #999;
}

.btn-profile-sm {
  background: none;
  border: 1px solid #dadce0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  flex-shrink: 0;
  transition: all 0.1s;
}
.btn-profile-sm:hover { background: #e8f0fe; border-color: #1a73e8; }

.request-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-accept {
  padding: 4px 10px;
  background: #1a73e8;
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
}
.btn-accept:hover { background: #1557b0; }

.btn-reject {
  padding: 4px 10px;
  background: #fff;
  color: #d93025;
  border: 1px solid #f28b82;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
}
.btn-reject:hover { background: #fce8e6; }

/* ===== Right ===== */
.friends-right {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #f8f9fa;
}

.no-friend-selected {
  text-align: center;
  color: #999;
}

.no-select-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.no-friend-selected p {
  font-size: 14px;
  margin: 0;
}
</style>
