<!-- src/comments/CommentList.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import type { Comment } from '@/types'

const props = defineProps<{
  postId: number
}>()

const userStore = useUserStore()
const comments = ref<Comment[]>([])
const newComment = ref('')
const isLoading = ref(false)

// 加载评论
const loadComments = async () => {
  try {
    // 假设后端返回的是树形结构，或者平铺结构我们在前端组装
    // 这里假设后端平铺返回，前端根据 parentId 组装
    const res = await http.get(`/posts/${props.postId}/comments`)
    const flatComments = res.data as Comment[]

    // 组装成两级树
    comments.value = flatComments
      .filter(c => c.parentId === null)
      .map(parent => ({
        ...parent,
        children: flatComments.filter(child => child.parentId === parent.id)
      }))
  } catch (error) {
    console.error('加载评论失败', error)
  }
}

// 提交评论
const submitComment = async (parentId: number | null = null) => {
  if (!newComment.value.trim()) return
  if (!userStore.isLogin()) {
    alert('请先登录再评论')
    return
  }

  try {
    await http.post(`/posts/${props.postId}/comments`, {
      body: newComment.value.trim(),
      parentId: parentId
    })
    newComment.value = ''
    await loadComments() // 刷新列表
  } catch (error: any) {
    alert(error.message || '评论失败')
  }
}

onMounted(() => {
  loadComments()
})

// 暴露刷新方法给父组件
defineExpose({ loadComments })
</script>

<template>
  <div class="comment-section">
    <h3 class="comment-title">评论区 ({{ comments.length }})</h3>

    <!-- 发表主评论 -->
    <div class="comment-form">
      <textarea
        v-model="newComment"
        placeholder="写下你的想法..."
        rows="3"
        class="comment-textarea"
      ></textarea>
      <button class="btn-submit" @click="submitComment(null)" :disabled="isLoading">
        发表评论
      </button>
    </div>

    <!-- 评论列表 -->
    <div class="comment-list">
      <div v-for="parent in comments" :key="parent.id" class="comment-item">
        <div class="comment-main">
          <div class="comment-header">
            <span class="comment-author">{{ parent.authorName || '匿名用户' }}</span>
            <span class="comment-time">{{ new Date(parent.createdAt).toLocaleString() }}</span>
          </div>
          <p class="comment-body">{{ parent.body }}</p>
          <button class="btn-reply" @click="newComment = `@${parent.authorName} `">回复</button>
        </div>

        <!-- 子评论（第二级） -->
        <div v-if="parent.children && parent.children.length > 0" class="comment-children">
          <div v-for="child in parent.children" :key="child.id" class="comment-child-item">
            <div class="comment-header">
              <span class="comment-author">{{ child.authorName || '匿名用户' }}</span>
              <span class="comment-time">{{ new Date(child.createdAt).toLocaleString() }}</span>
            </div>
            <p class="comment-body">{{ child.body }}</p>
          </div>
        </div>
      </div>

      <div v-if="comments.length === 0" class="empty-comments">
        暂无评论，快来说两句吧！
      </div>
    </div>
  </div>
</template>

<style scoped>
.comment-section { margin-top: 32px; }
.comment-title { font-size: 18px; margin-bottom: 16px; color: #202124; }
.comment-form {
  background: #f8f9fa; padding: 16px; border-radius: 8px;
  display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;
}
.comment-textarea {
  border: 1px solid #dadce0; border-radius: 6px; padding: 12px;
  font-size: 14px; resize: vertical; outline: none; font-family: inherit;
}
.comment-textarea:focus { border-color: #1a73e8; }
.btn-submit {
  align-self: flex-end; padding: 8px 20px; background: #1a73e8;
  color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;
}
.btn-submit:hover { background: #1557b0; }
.btn-submit:disabled { background: #a8c7fa; cursor: not-allowed; }

.comment-list { display: flex; flex-direction: column; gap: 16px; }
.comment-item { border-bottom: 1px solid #e8eaed; padding-bottom: 16px; }
.comment-main { }
.comment-header { display: flex; gap: 12px; margin-bottom: 6px; align-items: center; }
.comment-author { font-weight: 600; font-size: 14px; color: #202124; }
.comment-time { font-size: 12px; color: #5f6368; }
.comment-body { font-size: 14px; color: #333; line-height: 1.6; margin: 0 0 8px 0; }
.btn-reply {
  background: none; border: none; color: #1a73e8; font-size: 13px; cursor: pointer; padding: 0;
}
.comment-children {
  margin-left: 40px; margin-top: 12px; background: #f8f9fa;
  padding: 12px; border-radius: 8px; display: flex; flex-direction: column; gap: 12px;
}
.comment-child-item { border-bottom: 1px dashed #dadce0; padding-bottom: 8px; }
.comment-child-item:last-child { border-bottom: none; padding-bottom: 0; }
.empty-comments { text-align: center; color: #5f6368; padding: 20px; }
</style>
