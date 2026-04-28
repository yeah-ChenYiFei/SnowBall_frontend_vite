<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import CommentItem from './CommentItem.vue' // ✅ 引入递归组件
import type { Comment } from '@/types'

const props = defineProps<{ postId: number }>()
const userStore = useUserStore()
const flatComments = ref<Comment[]>([])
const newComment = ref('')
const isLoading = ref(false)

// ✅ 记录当前正在回复谁
const replyTarget = ref<{ id: number | null, name: string }>({ id: null, name: '' })

// ✅ 核心：将后端返回的扁平数组，转换成树形结构（支持无限层级）
const commentTree = computed(() => {
  const map: Record<number, any> = {}
  const roots: any[] = []

  // 1. 初始化所有节点
  flatComments.value.forEach(c => {
    map[c.id] = { ...c, children: [] }
  })

  // 2. 建立父子关系
  flatComments.value.forEach(c => {
    if (c.parentId && map[c.parentId]) {
      map[c.parentId].children.push(map[c.id])
    } else {
      roots.push(map[c.id])
    }
  })

  return roots
})

const loadComments = async () => {
  try {
    const res = await http.get(`/posts/${props.postId}/comments`)
    flatComments.value = res.data || []
  } catch (error) {
    console.error('加载评论失败', error)
  }
}

// ✅ 接收子组件抛出的回复事件
const handleSetReply = (commentId: number, authorName: string) => {
  replyTarget.value = { id: commentId, name: authorName }
  // 自动聚焦输入框（可选优化）
}

// 提交评论
const submitComment = async () => {
  if (!newComment.value.trim()) return
  if (!userStore.isLogin()) return alert('请先登录')

  try {
    await http.post(`/posts/${props.postId}/comments`, {
      body: newComment.value.trim(), // ✅ 只发纯文本，不带 @
      parentId: replyTarget.value.id // ✅ 如果是回复，把父 ID 传过去
    })
    newComment.value = ''
    replyTarget.value = { id: null, name: '' } // 清空回复状态
    await loadComments()
  } catch (error: any) {
    alert(error.message || '评论失败')
  }
}

// 取消回复
const cancelReply = () => {
  replyTarget.value = { id: null, name: '' }
  newComment.value = ''
}

onMounted(() => { loadComments() })
defineExpose({ loadComments })
</script>

<template>
  <div class="comment-section">
    <h3 class="comment-title">评论区 ({{ flatComments.length }})</h3>

    <!-- 输入区 -->
    <div class="comment-form">
      <!-- ✅ 显示回复提示条 -->
      <div v-if="replyTarget.id" class="reply-hint">
        <span>正在回复 @{{ replyTarget.name }}</span>
        <button class="cancel-btn" @click="cancelReply">✕ 取消</button>
      </div>

      <textarea
        v-model="newComment"
        :placeholder="replyTarget.id ? `回复 @${replyTarget.name}...` : '写下你的想法...'"
        rows="3"
        class="comment-textarea"
      ></textarea>
      <button class="btn-submit" @click="submitComment" :disabled="isLoading">
        发表评论
      </button>
    </div>

    <!-- 评论树列表 -->
    <div class="comment-list">
      <CommentItem
        v-for="comment in commentTree"
        :key="comment.id"
        :comment="comment"
        @reply="handleSetReply"
      />

      <div v-if="flatComments.length === 0" class="empty-comments">
        暂无评论，快来说两句吧！
      </div>
    </div>
  </div>
</template>

<style scoped>
.comment-section { margin-top: 32px; }
.comment-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #202124; }
.comment-form {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
}
/* ✅ 回复提示条样式 */
.reply-hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #e8f0fe;
  color: #1a73e8;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 12px;
}
.cancel-btn {
  background: none; border: none; color: #1a73e8; cursor: pointer; font-size: 15px;
}
.comment-textarea {
  width: 100%;
  border: 1px solid #dadce0;
  border-radius: 6px;
  padding: 12px;
  font-size: 14px;
  resize: vertical;
  box-sizing: border-box;
  margin-bottom: 12px;
}
.btn-submit {
  float: right;
  padding: 8px 24px;
  background: #1a73e8;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-submit:hover { background: #1557b0; }
.comment-list::after { content: ''; display: block; clear: both; }
.empty-comments { text-align: center; color: #999; padding: 40px 0; }
</style>
