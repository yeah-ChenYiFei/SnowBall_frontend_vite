<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import ImageUploadButton from '@/components/ImageUploadButton.vue'
import type { Comment } from '@/types'

const props = defineProps<{
  comment: Comment
  parentAuthorName?: string
  activeReplyId: number | null
}>()

const emit = defineEmits<{
  (e: 'open-reply', id: number | null): void
  (e: 'submit-reply', parentId: number, body: string, imageUrl?: string): void
  (e: 'refresh'): void
  (e: 'open-lightbox', url: string): void
}>()

const router = useRouter()
const userStore = useUserStore()
const replyText = ref('')
const replyImageUrl = ref('')
const replyRef = ref<HTMLTextAreaElement | null>(null)

const isReplying = computed(() => props.comment.id === props.activeReplyId)
const liked = computed(() => props.comment.currentUserReaction === 'LIKE')

const handleReplyClick = () => {
  if (isReplying.value) {
    emit('open-reply', null)
  } else {
    replyText.value = ''
    replyImageUrl.value = ''
    emit('open-reply', props.comment.id)
  }
}

const handleCancel = () => {
  emit('open-reply', null)
}

const handleSubmitReply = () => {
  if (!replyText.value.trim() && !replyImageUrl.value) return
  if (!userStore.isLogin()) return alert('请先登录')
  emit('submit-reply', props.comment.id, replyText.value.trim() || '[图片]', replyImageUrl.value || undefined)
}

const handleLike = async () => {
  if (!userStore.isLogin()) return alert('请先登录')
  try {
    await http.post(`/posts/${props.comment.postId}/comments/${props.comment.id}/react?type=LIKE`)
    emit('refresh')
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

watch(isReplying, (newVal) => {
  if (newVal) {
    nextTick(() => replyRef.value?.focus())
  } else {
    replyText.value = ''
  }
})
</script>

<template>
  <div class="comment-item">
    <div class="comment-main">
      <div class="comment-header">
        <span
          class="comment-author"
          @click="router.push(`/profile/${comment.userId}`)"
        >{{ comment.authorName || '匿名用户' }}</span>
        <span class="comment-time">{{ new Date(comment.createdAt).toLocaleString() }}</span>
      </div>
      <p class="comment-body">
        <span v-if="parentAuthorName" class="reply-tag">/@{{ parentAuthorName }}</span>
        {{ comment.body }}
      </p>
      <img
        v-if="comment.imageUrl"
        :src="comment.imageUrl"
        class="comment-image"
        @click="emit('open-lightbox', comment.imageUrl!)"
      />
      <div class="comment-actions">
        <button
          class="btn-like"
          :class="{ liked }"
          @click="handleLike"
        >
          {{ liked ? '❤️' : '🤍' }} {{ comment.likeCount || 0 }}
        </button>
        <button class="btn-reply" @click="handleReplyClick">回复</button>
      </div>

      <div v-if="isReplying" class="inline-reply-box">
        <textarea
          ref="replyRef"
          v-model="replyText"
          :placeholder="`回复 @${comment.authorName || '匿名用户'}...`"
          rows="2"
          class="inline-textarea"
        ></textarea>
        <div class="inline-reply-actions">
          <ImageUploadButton @uploaded="replyImageUrl = $event" />
          <span class="inline-spacer"></span>
          <button class="btn-inline-submit" @click="handleSubmitReply">发送</button>
          <button class="btn-inline-cancel" @click="handleCancel">取消</button>
        </div>
      </div>
    </div>

    <div v-if="comment.children && comment.children.length > 0" class="children-thread">
      <CommentItem
        v-for="child in comment.children"
        :key="child.id"
        :comment="child"
        :parent-author-name="comment.authorName"
        :active-reply-id="activeReplyId"
        @open-reply="(id: number | null) => emit('open-reply', id)"
        @submit-reply="(pid: number, body: string, imgUrl?: string) => emit('submit-reply', pid, body, imgUrl)"
        @refresh="emit('refresh')"
        @open-lightbox="(url: string) => emit('open-lightbox', url)"
      />
    </div>
  </div>
</template>

<style scoped>
.comment-item { margin-top: 12px; min-width: 0; }
.comment-main { padding: 12px; background: #fff; border-radius: 6px; border: 1px solid #e8eaed; overflow: hidden; }
.comment-header { display: flex; gap: 12px; font-size: 13px; color: #999; margin-bottom: 8px; flex-wrap: wrap; }
.comment-author { color: #1a73e8; font-weight: 600; white-space: nowrap; cursor: pointer; }
.comment-author:hover { text-decoration: underline; }
.comment-body { margin: 0 0 8px 0; font-size: 15px; line-height: 1.5; color: #333; overflow-wrap: break-word; word-break: break-word; }
.reply-tag { color: #1a73e8; font-size: 13px; margin-right: 4px; }
.comment-actions { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.btn-like { background: none; border: none; cursor: pointer; font-size: 14px; padding: 2px 4px; border-radius: 4px; white-space: nowrap; }
.btn-like:hover { background: #fff0f0; }
.btn-like.liked { font-weight: 600; }
.btn-reply { background: none; border: none; color: #999; font-size: 13px; cursor: pointer; padding: 2px 4px; white-space: nowrap; }
.btn-reply:hover { color: #1a73e8; }
.comment-image {
  max-width: 240px; max-height: 200px; border-radius: 6px;
  cursor: pointer; object-fit: cover; display: block; margin-bottom: 8px;
}
.inline-spacer { flex: 1; }
.children-thread { margin-left: 12px; padding-left: 8px; border-left: 2px solid #e8eaed; overflow: hidden; }

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
