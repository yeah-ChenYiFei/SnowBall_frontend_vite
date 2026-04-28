<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useUserStore } from '@/stores/user'
import type { Comment } from '@/types'

const props = defineProps<{
  comment: Comment
  parentAuthorName?: string
  activeReplyId: number | null // ✅ 接收当前处于激活状态的评论 ID
}>()

const emit = defineEmits<{
  (e: 'open-reply', id: number | null): void
  (e: 'submit-reply', parentId: number, body: string): void
}>()

const userStore = useUserStore()
const replyText = ref('')
const replyRef = ref<HTMLTextAreaElement | null>(null)

// 判断当前评论是不是那个被激活的
const isReplying = computed(() => props.comment.id === props.activeReplyId)

// 点击回复按钮
const handleReplyClick = () => {
  if (isReplying.value) {
    emit('open-reply', null) // 如果已经打开了，再点就关闭
  } else {
    replyText.value = ''
    emit('open-reply', props.comment.id) // 否则请求打开自己
  }
}

// 取消回复
const handleCancel = () => {
  emit('open-reply', null)
}

// 提交回复
const handleSubmitReply = () => {
  if (!replyText.value.trim()) return
  if (!userStore.isLogin()) return alert('请先登录')
  emit('submit-reply', props.comment.id, replyText.value.trim())
}

// ✅ 监听状态：一旦变为 true，自动聚焦小输入框
watch(isReplying, (newVal) => {
  if (newVal) {
    nextTick(() => replyRef.value?.focus())
  } else {
    replyText.value = '' // 关闭时清空内容
  }
})
</script>

<template>
  <div class="comment-item">
    <div class="comment-main">
      <div class="comment-header">
        <span class="comment-author">{{ comment.authorName || '匿名用户' }}</span>
        <span class="comment-time">{{ new Date(comment.createdAt).toLocaleString() }}</span>
      </div>
      <p class="comment-body">
        <span v-if="parentAuthorName" class="reply-tag">/@{{ parentAuthorName }}</span>
        {{ comment.body }}
      </p>
      <button class="btn-reply" @click="handleReplyClick">回复</button>

      <!-- ✅ 新增：紧贴着评论的下方小输入框 -->
      <div v-if="isReplying" class="inline-reply-box">
        <textarea
          ref="replyRef"
          v-model="replyText"
          :placeholder="`回复 @${comment.authorName || '匿名用户'}...`"
          rows="2"
          class="inline-textarea"
        ></textarea>
        <div class="inline-reply-actions">
          <button class="btn-inline-submit" @click="handleSubmitReply">发送</button>
          <button class="btn-inline-cancel" @click="handleCancel">取消</button>
        </div>
      </div>
    </div>

    <!-- 递归子评论，必须把激活状态和事件继续透传给子级 -->
    <div v-if="comment.children && comment.children.length > 0" class="children-thread">
      <CommentItem
        v-for="child in comment.children"
        :key="child.id"
        :comment="child"
        :parent-author-name="comment.authorName"
        :active-reply-id="activeReplyId"
        @open-reply="(id) => emit('open-reply', id)"
        @submit-reply="(pid, body) => emit('submit-reply', pid, body)"
      />
    </div>
  </div>
</template>

<style scoped>
.comment-item { margin-top: 12px; }
.comment-main { padding: 12px; background: #fff; border-radius: 6px; border: 1px solid #e8eaed; }
.comment-header { display: flex; gap: 12px; font-size: 13px; color: #999; margin-bottom: 8px; }
.comment-author { color: #1a73e8; font-weight: 600; }
.comment-body { margin: 0 0 8px 0; font-size: 15px; line-height: 1.5; color: #333; }
.reply-tag { color: #1a73e8; font-size: 13px; margin-right: 4px; }
.btn-reply { background: none; border: none; color: #999; font-size: 13px; cursor: pointer; padding: 0; }
.btn-reply:hover { color: #1a73e8; }
.children-thread { margin-left: 20px; padding-left: 16px; border-left: 2px solid #e8eaed; }

/* ✅ 小输入框的专属样式 */
.inline-reply-box {
  margin-top: 10px;
  background: #f8f9fa;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #e8eaed;
}
.inline-textarea {
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  font-size: 14px;
  resize: none;
  box-sizing: border-box;
  outline: none;
}
.inline-textarea:focus { border-color: #1a73e8; }
.inline-reply-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.btn-inline-submit {
  padding: 4px 12px;
  background: #1a73e8;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.btn-inline-cancel {
  padding: 4px 12px;
  background: #fff;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
</style>
