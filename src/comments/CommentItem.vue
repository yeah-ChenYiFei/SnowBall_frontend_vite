<script setup lang="ts">
import type { Comment } from '@/types'

// 接收单条评论数据，以及父级作者的名字（用于显示 @xxx）
const props = defineProps<{
  comment: Comment
  parentAuthorName?: string
}>()

// 向上抛出回复事件，告诉外层：“我要回复这条评论”
const emit = defineEmits<{
  (e: 'reply', commentId: number, authorName: string): void
}>()
</script>

<template>
  <div class="comment-item">
    <div class="comment-main">
      <div class="comment-header">
        <span class="comment-author">{{ comment.authorName || '匿名用户' }}</span>
        <span class="comment-time">{{ new Date(comment.createdAt).toLocaleString() }}</span>
      </div>

      <!-- ✅ 如果有 parentAuthorName，说明是回复，动态拼接显示，但不存数据库 -->
      <p class="comment-body">
        <span v-if="parentAuthorName" class="reply-tag">/@{{ parentAuthorName }}</span>
        {{ comment.body }}
      </p>

      <button class="btn-reply" @click="emit('reply', comment.id, comment.authorName || '匿名用户')">
        回复
      </button>
    </div>

    <!-- ✅ 递归渲染子评论：自己调用自己，把当前评论的作者名传给子级 -->
    <div v-if="comment.children && comment.children.length > 0" class="children-thread">
      <CommentItem
        v-for="child in comment.children"
        :key="child.id"
        :comment="child"
        :parent-author-name="comment.authorName"
        @reply="(id, name) => emit('reply', id, name)"
      />
    </div>
  </div>
</template>

<style scoped>
.comment-item {
  margin-top: 12px;
}
.comment-main {
  padding: 12px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e8eaed;
}
.comment-header {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: #999;
  margin-bottom: 8px;
}
.comment-author {
  color: #1a73e8;
  font-weight: 600;
}
.comment-body {
  margin: 0 0 8px 0;
  font-size: 15px;
  line-height: 1.5;
  color: #333;
}
/* ✅ 动态拼接的@标签样式 */
.reply-tag {
  color: #1a73e8;
  font-size: 13px;
  margin-right: 4px;
}
.btn-reply {
  background: none;
  border: none;
  color: #999;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}
.btn-reply:hover {
  color: #1a73e8;
}

/* ✅ Reddit 风格的左侧连接线 + 缩进 */
.children-thread {
  margin-left: 20px;
  padding-left: 16px;
  border-left: 2px solid #e8eaed;
}
</style>
