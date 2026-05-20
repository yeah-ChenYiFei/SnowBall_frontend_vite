<script setup lang="ts">
import { ref } from 'vue'
import http from '@/api/http'
import PostImageGrid from '@/components/PostImageGrid.vue'
import type { Post } from '@/types'

const emit = defineEmits<{ (e: 'close'): void; (e: 'created', post: Post): void }>()

const title = ref('')
const body = ref('')
const images = ref<string[]>([])
const isSubmitting = ref(false)

async function submit() {
  if (!title.value.trim() && images.value.length === 0) return
  isSubmitting.value = true
  try {
    const res = await http.post<Post>('/posts', {
      title: title.value.trim() || '无标题',
      body: body.value.trim(),
      type: 'THOUGHT',
      images: images.value.length > 0 ? images.value : undefined,
    })
    emit('created', res.data)
    emit('close')
  } catch (e: any) {
    alert(e.message || '发帖失败')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')">
      <div class="modal-card">
        <h2 class="modal-title">发帖</h2>
        <p class="modal-subtitle">分享你的零散想法</p>

        <input
          v-model="title"
          class="modal-input"
          placeholder="帖子标题"
          maxlength="100"
          autofocus
        />

        <div class="modal-images">
          <PostImageGrid v-model="images" />
        </div>

        <textarea
          v-model="body"
          class="modal-textarea"
          placeholder="写下你的想法..."
          rows="6"
        ></textarea>

        <div class="modal-actions">
          <button class="btn-cancel" @click="emit('close')">取消</button>
          <button
            class="btn-submit"
            :disabled="(!title.trim() && images.length === 0) || isSubmitting"
            @click="submit"
          >
            {{ isSubmitting ? '发布中...' : '发布' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center;
  padding: 24px; backdrop-filter: blur(4px);
}
.modal-card {
  background: #fff; border-radius: 16px; padding: 32px 28px 24px;
  width: 100%; max-width: 560px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
  max-height: 90vh; overflow-y: auto;
}
.modal-title {
  font-size: 22px; font-weight: 700; color: #202124;
  margin: 0 0 4px 0; text-align: center;
}
.modal-subtitle {
  font-size: 13px; color: #999; margin: 0 0 24px 0; text-align: center;
}
.modal-input {
  width: 100%; padding: 12px 14px; border: 1px solid #dadce0;
  border-radius: 8px; font-size: 15px; margin-bottom: 16px;
  box-sizing: border-box; outline: none; font-family: inherit;
}
.modal-input:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,0.12); }
.modal-images { margin-bottom: 16px; }
.modal-textarea {
  width: 100%; padding: 14px; border: 1px solid #dadce0;
  border-radius: 8px; font-size: 15px; line-height: 1.7;
  resize: vertical; box-sizing: border-box; outline: none; font-family: inherit;
}
.modal-textarea:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,0.12); }
.modal-actions {
  display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;
}
.btn-cancel {
  padding: 10px 24px; background: #fff; border: 1px solid #dadce0;
  border-radius: 8px; font-size: 14px; color: #5f6368; cursor: pointer;
}
.btn-cancel:hover { background: #f1f3f4; }
.btn-submit {
  padding: 10px 28px; background: #1a73e8; border: none; border-radius: 8px;
  font-size: 14px; color: #fff; cursor: pointer; font-weight: 500;
}
.btn-submit:hover:not(:disabled) { background: #1557b0; }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
