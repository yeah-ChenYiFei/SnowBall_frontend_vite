<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import CommentItem from './CommentItem.vue'
import type { Comment } from '@/types'

const props = defineProps<{ postId: number }>()
const userStore = useUserStore()
const flatComments = ref<Comment[]>([])
const newComment = ref('') // 现在只用于发表一级主评论
const isLoading = ref(false)

// ✅ 核心状态：记录当前展开的小输入框是属于哪条评论的
const activeReplyId = ref<number | null>(null)

const commentTree = computed(() => {
  const map: Record<number, any> = {}
  const roots: any[] = []
  flatComments.value.forEach(c => { map[c.id] = { ...c, children: [] } })
  flatComments.value.forEach(c => {
    if (c.parentId && map[c.parentId]) { map[c.parentId].children.push(map[c.id]) }
    else { roots.push(map[c.id]) }
  })
  return roots
})

const loadComments = async () => {
  try {
    const res = await http.get(`/posts/${props.postId}/comments`)
    flatComments.value = res.data || []
  } catch (error) { console.error('加载评论失败', error) }
}

// ✅ 提交一级主评论
const submitMainComment = async () => {
  if (!newComment.value.trim()) return
  if (!userStore.isLogin()) return alert('请先登录')
  try {
    await http.post(`/posts/${props.postId}/comments`, {
      body: newComment.value.trim(),
      parentId: null // 一级评论没有 parentId
    })
    newComment.value = ''
    await loadComments()
  } catch (error: any) { alert(error.message || '评论失败') }
}

// ✅ 接收子组件的打开/关闭事件
const handleOpenReply = (id: number | null) => {
  activeReplyId.value = id
}

// ✅ 接收子组件提交的回复
const handleSubmitReply = async (parentId: number, body: string) => {
  try {
    await http.post(`/posts/${props.postId}/comments`, {
      body: body,
      parentId: parentId
    })
    activeReplyId.value = null // 提交成功后收起小输入框
    await loadComments()      // 刷新列表
  } catch (error: any) { alert(error.message || '回复失败') }
}

onMounted(() => { loadComments() })
defineExpose({ loadComments })
</script>

<template>
  <div class="comment-section">
    <h3 class="comment-title">评论区 ({{ flatComments.length }})</h3>

    <!-- 顶部输入区：现在专门用于发表一级主评论 -->
    <div class="comment-form">
      <textarea
        v-model="newComment"
        placeholder="写下你的想法..."
        rows="3"
        class="comment-textarea"
      ></textarea>
      <button class="btn-submit" @click="submitMainComment" :disabled="isLoading">
        发表评论
      </button>
    </div>

    <!-- 评论树列表 -->
    <div class="comment-list">
      <CommentItem
        v-for="comment in commentTree"
        :key="comment.id"
        :comment="comment"
        :active-reply-id="activeReplyId"
        @open-reply="handleOpenReply"
        @submit-reply="handleSubmitReply"
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
