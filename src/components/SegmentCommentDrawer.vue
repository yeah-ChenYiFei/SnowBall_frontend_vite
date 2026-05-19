<script setup lang="ts">
import { ref, watch } from 'vue'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import type { SegmentComment } from '@/types'

const props = defineProps<{
  segmentId: number
  visible: boolean
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const userStore = useUserStore()
const comments = ref<SegmentComment[]>([])
const isLoading = ref(false)
const newBody = ref('')
const isSubmitting = ref(false)

async function loadComments() {
  if (!props.segmentId) return
  isLoading.value = true
  try {
    const res = await http.get<SegmentComment[]>(`/chains/segments/${props.segmentId}/comments`)
    comments.value = res.data || []
  } catch { /* silent */ }
  finally { isLoading.value = false }
}

async function submitComment() {
  if (!newBody.value.trim()) return
  isSubmitting.value = true
  try {
    const res = await http.post<SegmentComment>(`/chains/segments/${props.segmentId}/comments`, {
      body: newBody.value.trim(),
    })
    comments.value.push(res.data)
    newBody.value = ''
  } catch (e: any) {
    alert(e.message || '评论失败')
  } finally {
    isSubmitting.value = false
  }
}

watch(() => props.segmentId, () => {
  if (props.visible) loadComments()
})

watch(() => props.visible, (v) => {
  if (v) loadComments()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="visible" class="drawer-overlay" @click.self="emit('close')">
        <div class="drawer-panel">
          <div class="drawer-header">
            <h3>评论</h3>
            <button class="btn-close" @click="emit('close')">✕</button>
          </div>

          <div class="drawer-body">
            <div v-if="isLoading" class="loading-state">加载中...</div>
            <div v-else-if="comments.length === 0" class="empty-state">暂无评论</div>
            <div v-else class="comment-list">
              <div v-for="c in comments" :key="c.id" class="comment-item">
                <div class="comment-author">{{ c.username }}</div>
                <div class="comment-body">{{ c.body }}</div>
                <div class="comment-time">{{ new Date(c.createdAt).toLocaleDateString('zh-CN') }}</div>
              </div>
            </div>
          </div>

          <div v-if="userStore.isLogin()" class="drawer-input">
            <textarea
              v-model="newBody"
              placeholder="发表评论..."
              rows="2"
              class="drawer-textarea"
            ></textarea>
            <button
              class="btn-send"
              :disabled="!newBody.trim() || isSubmitting"
              @click="submitComment"
            >
              发送
            </button>
          </div>
          <div v-else class="drawer-login-hint">
            <router-link to="/login" @click="emit('close')">登录</router-link> 后发表评论
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({ name: 'SegmentCommentDrawer' })
</script>

<style scoped>
.drawer-overlay {
  position: fixed; inset: 0; z-index: 1500;
  background: rgba(0, 0, 0, 0.3);
}
.drawer-panel {
  position: fixed; top: 0; right: 0; bottom: 0; width: 380px; max-width: 90vw;
  background: #fff; box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
  display: flex; flex-direction: column;
}
.drawer-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px; border-bottom: 1px solid #e8eaed; flex-shrink: 0;
}
.drawer-header h3 { margin: 0; font-size: 18px; color: #202124; }
.btn-close {
  background: none; border: none; font-size: 20px; color: #999; cursor: pointer;
  padding: 4px 8px; border-radius: 4px;
}
.btn-close:hover { background: #f1f3f4; }
.drawer-body {
  flex: 1; overflow-y: auto; padding: 20px 24px;
}
.loading-state, .empty-state { text-align: center; color: #999; padding: 40px 0; font-size: 14px; }
.comment-list { display: flex; flex-direction: column; gap: 16px; }
.comment-item {
  padding: 14px; background: #f8f9fa; border-radius: 10px;
}
.comment-author { font-size: 13px; font-weight: 600; color: #1a73e8; margin-bottom: 6px; }
.comment-body { font-size: 14px; color: #333; line-height: 1.6; }
.comment-time { font-size: 11px; color: #999; margin-top: 6px; }
.drawer-input {
  padding: 16px 24px; border-top: 1px solid #e8eaed; display: flex; gap: 10px;
  align-items: flex-end; flex-shrink: 0;
}
.drawer-textarea {
  flex: 1; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 8px;
  font-size: 14px; line-height: 1.5; resize: none; outline: none; font-family: inherit;
}
.drawer-textarea:focus { border-color: #1a73e8; }
.btn-send {
  padding: 10px 18px; background: #1a73e8; color: #fff; border: none;
  border-radius: 8px; font-size: 14px; cursor: pointer; white-space: nowrap;
}
.btn-send:hover:not(:disabled) { background: #1557b0; }
.btn-send:disabled { opacity: 0.5; cursor: not-allowed; }
.drawer-login-hint {
  padding: 16px 24px; text-align: center; font-size: 13px; color: #999;
  border-top: 1px solid #e8eaed; flex-shrink: 0;
}
.drawer-login-hint a { color: #1a73e8; }

/* Transition */
.drawer-enter-active { transition: opacity 0.25s ease; }
.drawer-enter-active .drawer-panel { transition: transform 0.3s ease; }
.drawer-leave-active { transition: opacity 0.2s ease; }
.drawer-leave-active .drawer-panel { transition: transform 0.25s ease; }
.drawer-enter-from { opacity: 0; }
.drawer-enter-from .drawer-panel { transform: translateX(100%); }
.drawer-leave-to { opacity: 0; }
.drawer-leave-to .drawer-panel { transform: translateX(100%); }
</style>
