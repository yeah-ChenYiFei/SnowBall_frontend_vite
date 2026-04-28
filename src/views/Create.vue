<!-- src/views/Create.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import http from '@/api/http'
import TagInput from '@/comments/TagInput.vue'
import type { Result } from '@/types'

const router = useRouter()
const route = useRoute()

// 判断是否是发起接龙模式
const isChainMode = ref(route.query.mode === 'chain')

const formData = ref({
  type: 'FRAGMENT',
  title: '',
  tags: [] as string[]
})

// ✅ 修复二：用一个统一的 ref 接管 v-model，不再写三元表达式
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
    let res: Result
    if (isChainMode.value) {
      // 接龙模式：传给后端接龙接口的字段
      res = await http.post('/chains', {
        title: formData.value.title,
        first_segment_body: content.value
      }) as Result
    } else {
      // 普通模式：传给后端发帖接口的字段
      res = await http.post('/posts', {
        ...formData.value,
        body: content.value
      }) as Result
    }

    // ✅ 修复一：现在 res 被识别为 any，不再报错
    if (res.code === 200) {
      message.value = isChainMode.value ? '🎉 接龙发起成功！' : '🎉 发布成功！'
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
  <div class="create-page">
    <h1>{{ isChainMode ? '发起故事接龙' : '创作新内容' }}</h1>
    <div class="form-container">
      <div v-if="message" class="alert" :class="message.includes('成功') ? 'alert-success' : 'alert-danger'">
        {{ message }}
      </div>

      <!-- 普通模式才显示类型选择 -->
      <div v-if="!isChainMode" class="mb-3">
        <label class="form-label">内容类型</label>
        <select v-model="formData.type" class="form-select">
          <option v-for="(label, key) in typeMap" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>

      <div class="mb-3">
        <label class="form-label">标题</label>
        <input v-model="formData.title" type="text" class="form-control" placeholder="给您的作品起个名字" />
      </div>

      <!-- 普通模式才显示标签 -->
      <div v-if="!isChainMode" class="mb-3">
        <label class="form-label">标签 (回车添加)</label>
        <TagInput v-model="formData.tags" />
      </div>

      <div class="mb-3">
        <label class="form-label">{{ isChainMode ? '故事起点 (第一段)' : '正文内容' }}</label>
        <!-- ✅ 修复二：v-model 直接绑定 content 变量 -->
        <textarea
          v-model="content"
          class="form-control"
          rows="15"
          :placeholder="isChainMode ? '写出这个故事的精彩开头，等待其他人续写...' : '在这里挥洒您的文采...'"
        ></textarea>
      </div>

      <button class="btn btn-primary" @click="handleSubmit" :disabled="isSubmitting">
        {{ isSubmitting ? '发布中...' : (isChainMode ? '发起接龙' : '公开发布') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.create-page { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
.create-page h1 { margin-bottom: 30px; color: #202124; }
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
