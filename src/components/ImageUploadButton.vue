<script setup lang="ts">
import { ref } from 'vue'
import http from '@/api/http'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'uploaded', url: string): void
}>()

const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function trigger() {
  fileInput.value?.click()
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { alert('请选择图片文件'); return }
  if (file.size > 10 * 1024 * 1024) { alert('图片不能超过10MB'); return }
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await http.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    emit('uploaded', (res.data as any).url)
  } catch (e: any) {
    alert(e.message || '上传失败')
  } finally {
    uploading.value = false
    input.value = ''
  }
}
</script>

<template>
  <button class="upload-btn" :disabled="disabled || uploading" @click="trigger" :title="uploading ? '上传中...' : '添加图片'">
    <span v-if="uploading" class="upload-spin">&#8987;</span>
    <span v-else class="upload-plus">+</span>
  </button>
  <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileChange" />
</template>

<style scoped>
.upload-btn {
  width: 36px; height: 36px; border-radius: 50%;
  border: 2px dashed #dadce0; background: #fff;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 20px; color: #5f6368; flex-shrink: 0; transition: all 0.2s;
}
.upload-btn:hover:not(:disabled) { border-color: #1a73e8; color: #1a73e8; background: #f8fbff; }
.upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.upload-spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
