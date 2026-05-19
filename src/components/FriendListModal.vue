<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useFriendStore } from '@/stores/friend'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const router = useRouter()
const friendStore = useFriendStore()
const tab = ref<'friends' | 'pending'>('friends')

if (props.show) {
  friendStore.init()
}

function goToProfile(userId: number) {
  emit('close')
  router.push(`/mine?userId=${userId}`)
}

async function handleAccept(id: number) {
  await friendStore.acceptRequest(id)
}

async function handleReject(id: number) {
  await friendStore.rejectRequest(id)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-card">
        <div class="modal-header">
          <h2>我的好友</h2>
          <button class="btn-close" @click="emit('close')">✕</button>
        </div>

        <div class="modal-tabs">
          <button
            :class="['tab-btn', { active: tab === 'friends' }]"
            @click="tab = 'friends'"
          >
            好友列表 ({{ friendStore.friends.length }})
          </button>
          <button
            :class="['tab-btn', { active: tab === 'pending' }]"
            @click="tab = 'pending'"
          >
            待处理
            <span v-if="friendStore.pendingRequests.length" class="badge">
              {{ friendStore.pendingRequests.length }}
            </span>
          </button>
        </div>

        <!-- Friends List -->
        <div v-if="tab === 'friends'" class="modal-body">
          <div v-if="friendStore.friends.length === 0" class="empty-hint">
            还没有好友，去广场或群组里认识新朋友吧！
          </div>
          <div
            v-for="f in friendStore.friends"
            :key="f.userId"
            class="friend-row"
            @click="goToProfile(f.userId)"
          >
            <div class="friend-avatar">{{ f.username?.charAt(0) || '?' }}</div>
            <span class="friend-name">{{ f.username }}</span>
          </div>
        </div>

        <!-- Pending Requests -->
        <div v-else class="modal-body">
          <div v-if="friendStore.pendingRequests.length === 0" class="empty-hint">
            没有待处理的好友请求
          </div>
          <div
            v-for="f in friendStore.pendingRequests"
            :key="f.userId"
            class="request-row"
          >
            <div class="friend-avatar">{{ f.username?.charAt(0) || '?' }}</div>
            <span class="friend-name">{{ f.username }}</span>
            <div class="request-actions">
              <button class="btn-accept" @click="handleAccept(f.userId)">同意</button>
              <button class="btn-reject" @click="handleReject(f.userId)">拒绝</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(4px);
}
.modal-card {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 440px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0,0,0,0.15);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 0;
}
.modal-header h2 { margin: 0; font-size: 18px; }
.btn-close {
  background: none; border: none; font-size: 20px;
  cursor: pointer; color: #5f6368;
}
.modal-tabs {
  display: flex;
  gap: 0;
  padding: 12px 24px;
  border-bottom: 1px solid #e8eaed;
}
.tab-btn {
  flex: 1;
  padding: 8px 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 14px;
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
  background: #d93025;
  color: #fff;
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 12px;
  margin-left: 4px;
}
.modal-body {
  flex: 1; overflow-y: auto; padding: 16px 24px;
}
.empty-hint {
  text-align: center; padding: 40px 0; color: #999; font-size: 14px;
}
.friend-row, .request-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.friend-row:hover, .request-row:hover { background: #f8f9fa; }
.friend-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: #1a73e8;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}
.friend-name { flex: 1; font-size: 14px; color: #202124; }
.request-row { cursor: default; }
.request-actions { display: flex; gap: 8px; }
.btn-accept {
  padding: 4px 14px;
  background: #1a73e8; color: #fff; border: none;
  border-radius: 6px; cursor: pointer; font-size: 13px;
}
.btn-accept:hover { background: #1557b0; }
.btn-reject {
  padding: 4px 14px;
  background: #fff; color: #d93025; border: 1px solid #f28b82;
  border-radius: 6px; cursor: pointer; font-size: 13px;
}
.btn-reject:hover { background: #fce8e6; }
</style>
