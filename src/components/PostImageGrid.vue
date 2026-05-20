<script setup lang="ts">
import { ref, computed } from 'vue'
import http from '@/api/http'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', urls: string[]): void
}>()

const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const maxImages = 9

function triggerUpload() {
  if (props.modelValue.length >= maxImages) return
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
    const newUrls = [...props.modelValue, (res.data as any).url]
    emit('update:modelValue', newUrls)
  } catch (e: any) {
    alert(e.message || '上传失败')
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function removeImage(index: number) {
  const newUrls = props.modelValue.filter((_, i) => i !== index)
  emit('update:modelValue', newUrls)
}

const totalSlots = computed(() => {
  const len = props.modelValue.length
  if (len === 0) return 3
  if (len < 3) return 3
  return Math.min(len + 1, maxImages)
})

// Layout: first row of 3, then subsequent rows
const rows = computed(() => {
  const urls = props.modelValue
  const result: { type: 'image' | 'add' | 'empty'; url?: string; index?: number }[][] = []
  let idx = 0
  const total = totalSlots.value

  for (let row = 0; idx < total; row++) {
    const rowItems: { type: 'image' | 'add' | 'empty'; url?: string; index?: number }[] = []
    for (let col = 0; col < 3 && idx < total; col++, idx++) {
      if (idx < urls.length) {
        rowItems.push({ type: 'image', url: urls[idx], index: idx })
      } else if (idx === urls.length) {
        rowItems.push({ type: 'add' })
      } else {
        rowItems.push({ type: 'empty' })
      }
    }
    result.push(rowItems)
  }
  return result
})
</script>


<template>
  <div class="image-grid">
    <div v-for="(row, ri) in rows" :key="ri" class="image-row">
      <div
        v-for="(cell, ci) in row"
        :key="ci"
        class="image-cell"
        :class="{ 'cell-add': cell.type === 'add', 'cell-empty': cell.type === 'empty', 'cell-image': cell.type === 'image' }"
        @click="cell.type === 'add' ? triggerUpload() : null"
      >
        <img v-if="cell.type === 'image' && cell.url" :src="cell.url" class="cell-thumb" />
        <button v-if="cell.type === 'image'" class="cell-remove" @click.stop="removeImage(cell.index!)">&times;</button>
        <span v-if="cell.type === 'add'" class="cell-plus">+</span>
      </div>
    </div>
    <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileChange" />
  </div>
</template>

<style scoped>
.image-grid { display: flex; flex-direction: column; gap: 8px; }
.image-row { display: flex; gap: 8px; }
.image-cell {
  width: 120px; height: 120px; border-radius: 8px;
  border: 2px dashed #dadce0; display: flex;
  align-items: center; justify-content: center; position: relative;
}
.cell-add {
  cursor: pointer; background: #f8f9fa; transition: border-color 0.2s;
}
.cell-add:hover { border-color: #1a73e8; background: #f8fbff; }
.cell-empty { border-color: #f0f0f0; background: #fafafa; }
.cell-image { border: 1px solid #e8eaed; overflow: hidden; }
.cell-thumb { width: 100%; height: 100%; object-fit: cover; }
.cell-remove {
  position: absolute; top: 4px; right: 4px;
  width: 20px; height: 20px; border-radius: 50%;
  background: rgba(0,0,0,0.5); color: #fff; border: none;
  cursor: pointer; font-size: 14px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
}
.cell-plus { font-size: 32px; color: #5f6368; }
</style>
