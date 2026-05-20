<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import TagInput from '@/comments/TagInput.vue'
import PostImageGrid from '@/components/PostImageGrid.vue'
import type { Result } from '@/types'

const router = useRouter()

const formData = ref({
  type: 'FRAGMENT',
  title: '',
  tags: [] as string[],
  images: [] as string[]
})

const content = ref('')
const isSubmitting = ref(false)
const message = ref('')

const typeMap: Record<string, string> = {
  OC: '原创角色 (OC)',
  SETTING: '世界观设定',
  FRAGMENT: '小说片段',
  BOOK_INFO: '书籍信息'
}

async function handleSubmit() {
  if (!formData.value.title || !content.value.trim()) {
    message.value = '标题和正文不能为空！'
    return
  }

  isSubmitting.value = true
  message.value = ''

  try {
    const res = await http.post('/posts', {
      ...formData.value,
      body: content.value
    }) as Result

    if (res.code === 200) {
      message.value = '🎉 发布成功！'
      setTimeout(() => router.push('/'), 1500)
    }
  } catch (error: any) {
    message.value = error.message || '网络错误'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="create-sub-page">
    <h1>文章写作</h1>
    <div class="form-container">
      <div v-if="message" class="alert" :class="message.includes('成功') ? 'alert-success' : 'alert-danger'">
        {{ message }}
      </div>

      <div class="mb-3">
        <label class="form-label">内容类型</label>
        <select v-model="formData.type" class="form-select">
          <option v-for="(label, key) in typeMap" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>

      <div class="mb-3">
        <label class="form-label">标题</label>
        <input v-model="formData.title" type="text" class="form-control" placeholder="给您的作品起个名字" />
      </div>

      <div class="mb-3">
        <label class="form-label">标签 (回车添加)</label>
        <TagInput v-model="formData.tags" />
      </div>

      <div class="mb-3">
        <label class="form-label">图片（可选，最多9张）</label>
        <PostImageGrid v-model="formData.images" />
      </div>

      <div class="mb-3">
        <label class="form-label">正文内容</label>
        <textarea
          v-model="content"
          class="form-control"
          rows="15"
          placeholder="在这里挥洒您的文采..."
        ></textarea>
      </div>

      <button class="btn btn-primary" @click="handleSubmit" :disabled="isSubmitting">
        {{ isSubmitting ? '发布中...' : '公开发布' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.create-sub-page { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
.create-sub-page h1 { margin-bottom: 30px; color: #202124; }
.form-container { background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.mb-3 { margin-bottom: 20px; }
.form-label { display: block; font-size: 14px; font-weight: 500; color: #202124; margin-bottom: 6px; }
.form-control, .form-select {
  width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 6px;
  font-size: 14px; outline: none; box-sizing: border-box; font-family: inherit;
}
.form-control:focus, .form-select:focus { border-color: #1a73e8; box-shadow: 0 0 0 2px rgba(26,115,232,0.1); }
.btn { padding: 10px 24px; border: none; border-radius: 6px; font-size: 15px; cursor: pointer; }
.btn-primary { background: #1a73e8; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #1557b0; }
.btn-primary:disabled { background: #a8c7fa; cursor: not-allowed; }
.alert { padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; }
.alert-success { background: #e6f4ea; color: #1e8e3e; border: 1px solid #ceead6; }
.alert-danger { background: #fce8e6; color: #d93025; border: 1px solid #f28b82; }
</style>
