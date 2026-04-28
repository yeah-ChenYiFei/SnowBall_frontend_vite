<!-- src/views/post/PostDetail.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http' // ✅ 替换 fetch
import CommentList from '@/comments/CommentList.vue' // ✅ 集成真实评论
import type { Post } from '@/types'

const route = useRoute()
const router = useRouter()
const post = ref<Post | null>(null)
const isLoading = ref(true)

const typeMap: Record<string, string> = {
  OC: '原创角色', SETTING: '世界观', FRAGMENT: '小说片段', BOOK_INFO: '书籍信息'
}

const loadPost = async () => {
  try {
    const res = await http.get(`/posts/${route.params.id}`)
    post.value = res.data
  } catch (error) {
    console.error('加载失败', error)
  } finally {
    isLoading.value = false
  }
}
// 删除帖子
const handleDelete = async () => {
  if (!confirm('确定要彻底删除这篇帖子吗？此操作不可逆！')) return

  try {
    await http.delete(`/posts/${route.params.id}`)
    alert('删除成功')
    router.push('/') // 删除后回首页
  } catch (error: any) {
    alert('删除失败：' + (error.message || '权限不足'))
  }
}

onMounted(() => {
  loadPost()
})
</script>

<template>
  <div class="detail-page">
    <div v-if="isLoading" class="loading">加载中...</div>

    <div v-else-if="post" class="detail-container">
      <button class="btn-back" @click="router.back()">← 返回</button>

      <article class="post-content">
        <div class="post-header">
          <span class="type-badge">{{ typeMap[post.type] || post.type }}</span>
          <span class="meta-info">
            👤 {{ post.authorName || '匿名' }} · {{ new Date(post.createdAt).toLocaleString() }} · V{{ post.version }}
          </span>
        </div>

        <h1 class="post-title">{{ post.title }}</h1>

        <!-- 标签展示 -->
        <div v-if="post.tags && post.tags.length > 0" class="post-tags">
          <span v-for="tag in post.tags" :key="tag" class="tag-pill">#{{ tag }}</span>
        </div>

        <div class="post-body">
          <p v-for="(line, index) in post.body.split('\n')" :key="index">{{ line }}</p>
        </div>

        <!-- 操作区预留 -->
        <div class="action-bar">
          <button class="action-btn" @click="router.push(`/post/${post.id}/edit`)">✏️ 编辑内容</button>
          <button class="action-btn" @click="router.push(`/post/${post.id}/versions`)">📜 版本历史</button>
          <!-- ✅ 新增删除按钮 -->
          <button class="action-btn btn-danger" @click="handleDelete">🗑️ 删除帖子</button>
        </div>
      </article>

      <!-- ✅ 真实评论区挂载 -->
      <CommentList :post-id="post.id" />
    </div>

    <div v-else class="error-state">
      <p>帖子不存在或已被删除</p>
      <router-link to="/">返回广场</router-link>
    </div>
  </div>
</template>

<style scoped>
.detail-page { max-width: 800px; margin: 0 auto; }
.loading, .error-state { text-align: center; padding: 60px 20px; color: #999; }
.error-state a { color: #1a73e8; }

.btn-back {
  background: none; border: none; color: #1a73e8; font-size: 14px;
  cursor: pointer; margin-bottom: 16px; padding: 0;
}
.detail-container { background: #fff; padding: 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.post-content { }
.post-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; color: #5f6368; font-size: 14px; }
.type-badge { background: #e8f0fe; color: #1a73e8; padding: 4px 10px; border-radius: 4px; font-size: 12px; }
.post-title { font-size: 28px; font-weight: 700; color: #202124; margin: 0 0 16px 0; line-height: 1.3; }
.post-tags { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
.tag-pill { background: #f1f3f4; color: #5f6368; padding: 4px 12px; border-radius: 12px; font-size: 13px; }
.post-body {
  font-size: 16px; line-height: 1.8; color: #333; margin-bottom: 32px;
  border-top: 1px solid #e8eaed; padding-top: 24px;
}
.post-body p { margin: 0 0 16px 0; }
.action-bar { display: flex; gap: 12px; padding-top: 16px; border-top: 1px solid #e8eaed; }
.action-btn {
  padding: 8px 16px; border: 1px solid #dadce0; background: #fff;
  border-radius: 6px; cursor: pointer; font-size: 14px; color: #333;
}
.action-btn:hover { background: #f8f9fa; border-color: #d2e3fc; color: #1a73e8; }
.action-btn.btn-danger { color: #d93025; border-color: #f28b82; }
.action-btn.btn-danger:hover { background: #fce8e6; color: #c5221f; border-color: #f28b82; }
</style>
