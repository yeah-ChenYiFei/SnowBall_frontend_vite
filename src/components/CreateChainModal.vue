<script setup lang="ts">
import { ref } from 'vue'
import http from '@/api/http'
import type { PublicChain, ChainCreateForm } from '@/types'

const emit = defineEmits<{ (e: 'close'): void; (e: 'created', chain: PublicChain): void }>()

const form = ref<ChainCreateForm>({
  title: '',
  description: '',
  deadline: '',
  firstSegmentBody: '',
})
const isSubmitting = ref(false)

function isValid(): boolean {
  return !!form.value.title.trim() && !!form.value.firstSegmentBody.trim()
}

async function submit() {
  if (!isValid()) return
  isSubmitting.value = true
  try {
    const payload = {
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      deadline: form.value.deadline ? new Date(form.value.deadline).toISOString() : null,
      // snake_case for Java backend
      first_segment_body: form.value.firstSegmentBody.trim(),
    }
    const res = await http.post<PublicChain>('/chains/public', payload)
    emit('created', res.data)
    emit('close')
  } catch (e: any) {
    alert(e.message || '发布接龙失败')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')">
      <div class="modal-card">
        <h2 class="modal-title">发布接龙</h2>
        <p class="modal-subtitle">发起一个公共接龙，邀请大家一起续写</p>

        <label class="field-label">标题</label>
        <input
          v-model="form.title"
          class="modal-input"
          placeholder="给你的接龙起个名字"
          maxlength="100"
          autofocus
        />

        <label class="field-label">简介</label>
        <textarea
          v-model="form.description"
          class="modal-textarea short"
          placeholder="简单介绍一下这个接龙的背景或主题..."
          rows="3"
        ></textarea>

        <label class="field-label">截止日期（可选）</label>
        <input v-model="form.deadline" type="date" class="modal-input" />

        <label class="field-label">第一段</label>
        <textarea
          v-model="form.firstSegmentBody"
          class="modal-textarea"
          placeholder="写下故事的开头..."
          rows="6"
        ></textarea>

        <div class="modal-actions">
          <button class="btn-cancel" @click="emit('close')">取消</button>
          <button
            class="btn-submit"
            :disabled="!isValid() || isSubmitting"
            @click="submit"
          >
            {{ isSubmitting ? '发布中...' : '发布接龙' }}
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
  width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
}
.modal-title {
  font-size: 22px; font-weight: 700; color: #202124;
  margin: 0 0 4px 0; text-align: center;
}
.modal-subtitle {
  font-size: 13px; color: #999; margin: 0 0 24px 0; text-align: center;
}
.field-label {
  display: block; font-size: 13px; font-weight: 500; color: #5f6368;
  margin-bottom: 6px;
}
.modal-input {
  width: 100%; padding: 10px 14px; border: 1px solid #dadce0;
  border-radius: 8px; font-size: 14px; margin-bottom: 16px;
  box-sizing: border-box; outline: none; font-family: inherit;
}
.modal-input:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,0.12); }
.modal-textarea {
  width: 100%; padding: 12px 14px; border: 1px solid #dadce0;
  border-radius: 8px; font-size: 14px; line-height: 1.7;
  resize: vertical; box-sizing: border-box; outline: none; font-family: inherit;
  margin-bottom: 16px;
}
.modal-textarea.short { margin-bottom: 16px; }
.modal-textarea:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,0.12); }
.modal-actions {
  display: flex; justify-content: flex-end; gap: 12px; margin-top: 4px;
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
