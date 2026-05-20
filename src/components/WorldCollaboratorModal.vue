<script setup lang="ts">
import { ref, watch } from 'vue'
import http from '@/api/http'
import { useFriendStore } from '@/stores/friend'
import UserAvatar from '@/components/UserAvatar.vue'
import type { Friend, Collaborator } from '@/types'

const props = defineProps<{
  show: boolean
  worldId: number
  existingCollaborators: Collaborator[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'added'): void
}>()

const friendStore = useFriendStore()
const isSubmitting = ref(false)

const existingIds = new Set(props.existingCollaborators.map(c => c.userId))

const availableFriends = ref<Friend[]>([])

watch(() => props.show, async (val) => {
  if (val) {
    await friendStore.loadFriends()
    availableFriends.value = friendStore.friends.filter(f => !existingIds.has(f.userId))
  }
})

async function addCollaborator(friendId: number) {
  isSubmitting.value = true
  try {
    await http.post(`/worlds/${props.worldId}/collaborators`, { friendId })
    emit('added')
  } catch (e: any) {
    alert(e.message || '添加失败')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-card">
        <div class="modal-header">
          <h2>添加共创者</h2>
          <button class="btn-close" @click="emit('close')">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="availableFriends.length === 0" class="empty-hint">
            没有可添加的好友（已是共创者或尚未添加好友）
          </div>
          <div
            v-for="f in availableFriends"
            :key="f.userId"
            class="friend-row"
          >
            <UserAvatar :username="f.username || '?'" :avatar-url="f.avatarUrl" :size="36" class="friend-avatar" />
            <span class="friend-name">{{ f.username }}</span>
            <button
              class="btn-add"
              :disabled="isSubmitting"
              @click="addCollaborator(f.userId)"
            >
              添加
            </button>
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
  background: #fff; border-radius: 16px;
  width: 100%; max-width: 400px; max-height: 70vh;
  display: flex; flex-direction: column;
  box-shadow: 0 16px 48px rgba(0,0,0,0.15);
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 24px 0;
}
.modal-header h2 { margin: 0; font-size: 18px; }
.btn-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #5f6368; }
.modal-body { padding: 16px 24px 24px; overflow-y: auto; }
.empty-hint { text-align: center; padding: 30px 0; color: #999; font-size: 14px; }
.friend-row { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 8px; }
.friend-row:hover { background: #f8f9fa; }
.friend-avatar {
  /* sizing handled by UserAvatar component */
}
.friend-name { flex: 1; font-size: 14px; color: #202124; }
.btn-add {
  padding: 6px 16px; background: #1a73e8; color: #fff;
  border: none; border-radius: 6px; cursor: pointer; font-size: 13px;
}
.btn-add:hover:not(:disabled) { background: #1557b0; }
.btn-add:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
