<!-- src/views/post/PostEdit.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import TagInput from '@/comments/TagInput.vue'
import PostImageGrid from '@/components/PostImageGrid.vue'
import type { Post } from '@/types'

const route = useRoute()
const router = useRouter()

const postId = Number(route.params.id)
const isLoading = ref(true)

const formData = ref({
  title: '',
  body: '',
  tags: [] as string[],
  images: [] as string[]
})

// 核心：类似 Git commit -m 的变更摘要
const changeSummary = ref('')
const message = ref('')
const isSubmitting = ref(false)

onMounted(async () => {
  try {
    const res = await http.get(`/posts/${postId}`)
    const post: Post = res.data
    formData.value.title = post.title
    formData.value.body = post.body
    formData.value.tags = post.tags || []
    formData.value.images = post.images || []
  } catch (error: any) {
    message.value = '加载原始内容失败：' + (error.message || '未找到帖子')
  } finally {
    isLoading.value = false
  }
})

const handleSubmit = async () => {
  if (!formData.value.title || !formData.value.body) {
    message.value = '标题和正文不能为空！'
    return
  }

  isSubmitting.value = true
  message.value = ''

  try {
    // 提交修改，携带变更摘要
    await http.put(`/posts/${postId}`, {
      title: formData.value.title,
      body: formData.value.body,
      tags: formData.value.tags,
      images: formData.value.images,
              changeSummary: changeSummary.value || '无备注更新'
    })

    message.value = '🎉 保存成功！已生成新的历史版本。'
    setTimeout(() => router.push(`/post/${postId}`), 1500)
  } catch (error: any) {
    // 核心：处理设计文档 3.1.2 要求的 409 乐观锁冲突
    if (error.message.includes('409') || error.code === 409) {
      message.value = '⚠️ 发生冲突：该内容刚被其他人修改过，请点击返回，刷新页面获取最新版本后再编辑！'
    } else {
      message.value = '保存失败：' + (error.message || '服务器错误')
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="edit-page">
    <h1>编辑内容</h1>

    <div v-if="isLoading" class="loading">加载原始内容中...</div>

    <div v-else class="form-container">
      <div v-if="message" class="alert" :class="message.includes('成功') ? 'alert-success' : 'alert-danger'">
        {{ message }}
      </div>

      <div class="mb-3">
        <label class="form-label">标题</label>
        <input v-model="formData.title" type="text" class="form-control" placeholder="修改标题" />
      </div>

      <div class="mb-3">
        <label class="form-label">标签</label>
        <TagInput v-model="formData.tags" />
      </div>

      <div class="mb-3">
        <label class="form-label">图片（可选，最多9张）</label>
        <PostImageGrid v-model="formData.images" />
      </div>

      <div class="mb-3">
        <label class="form-label">正文内容</label>
        <textarea v-model="formData.body" class="form-control" rows="18"></textarea>
      </div>

      <!-- 核心亮点：变更摘要输入框 -->
      <div class="mb-3 summary-box">
        <label class="form-label">变更摘要 <span class="text-muted">(类似 Git Commit Message)</span></label>
        <input
          v-model="changeSummary"
          type="text"
          class="form-control"
          placeholder="例如：修改了主角的性格描写，增加了环境渲染..."
        />
      </div>

      <div class="btn-group">
        <button class="btn btn-secondary" @click="router.back()">取消</button>
        <button class="btn btn-primary" @click="handleSubmit" :disabled="isSubmitting">
          {{ isSubmitting ? '保存中...' : '提交修改' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-page { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
.edit-page h1 { margin-bottom: 30px; color: #202124; }
.loading { text-align: center; padding: 40px; color: #666; }
.form-container { background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.mb-3 { margin-bottom: 20px; }
.form-label { display: block; font-size: 14px; font-weight: 500; color: #202124; margin-bottom: 6px; }
.text-muted { font-weight: 400; color: #5f6368; font-size: 13px; }
.form-control {
  width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 6px;
  font-size: 14px; outline: none; box-sizing: border-box; font-family: inherit;
}
.form-control:focus { border-color: #1a73e8; box-shadow: 0 0 0 2px rgba(26,115,232,0.1); }
.summary-box {
  background: #f8f9fa; padding: 16px; border-radius: 8px;
  border: 1px dashed #dadce0; margin-top: 24px;
}
.btn-group { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
.btn { padding: 10px 24px; border: none; border-radius: 6px; font-size: 15px; cursor: pointer; font-weight: 500; }
.btn-primary { background: #1a73e8; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #1557b0; }
.btn-primary:disabled { background: #a8c7fa; cursor: not-allowed; }
.btn-secondary { background: #fff; color: #333; border: 1px solid #dadce0; }
.btn-secondary:hover { background: #f8f9fa; }
.alert { padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; }
.alert-success { background: #e6f4ea; color: #1e8e3e; border: 1px solid #ceead6; }
.alert-danger { background: #fce8e6; color: #d93025; border: 1px solid #f28b82; }
</style>
