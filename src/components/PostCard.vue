<script setup lang="ts">
import type { Post } from '@/types'

defineProps<{
  post: Post
  imagePosition?: 'left' | 'right'
}>()

const typeLabel: Record<string, string> = {
  OC: '原创角色', SETTING: '世界观', FRAGMENT: '小说片段', BOOK_INFO: '书籍信息',
  ESSAY: '散文', DIARY: '日记', NOVEL: '小说', THOUGHT: '散帖',
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('zh-CN')
const stripBody = (body?: string) => body?.substring(0, 80) || ''
</script>

<template>
  <router-link :to="`/post/${post.id}`" class="post-card" :class="`img-${imagePosition || 'left'}`">
    <div class="card-cover">
      <img v-if="post.images?.length" :src="post.images[0] + '?thumb=1'" class="cover-img" loading="lazy" />
      <div v-else class="cover-placeholder">
        <span class="cover-icon">{{ typeLabel[post.type]?.[0] || '?' }}</span>
      </div>
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="card-type">{{ typeLabel[post.type] || post.type }}</span>
        <span class="card-date">{{ formatDate(post.createdAt) }}</span>
      </div>
      <h3 class="card-title">{{ post.title }}</h3>
      <p class="card-preview">{{ stripBody(post.body) }}</p>
      <div class="card-footer">
        <span class="card-author">{{ post.authorName || '匿名' }}</span>
        <span class="card-stats">
          <span v-if="post.likeCount">👍 {{ post.likeCount }}</span>
          <span v-if="post.commentCount">💬 {{ post.commentCount }}</span>
        </span>
      </div>
    </div>
  </router-link>
</template>

<style scoped>
.post-card {
  display: grid; grid-template-columns: 1fr 1fr;
  background: #fff; border-radius: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #f1f3f4;
  overflow: hidden; text-decoration: none; color: inherit;
  transition: transform 0.2s, box-shadow 0.2s;
  aspect-ratio: 1.5 / 1;
}
.post-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
.post-card.img-right { direction: rtl; }
.post-card.img-right .card-body { direction: ltr; }

.card-cover { overflow: hidden; background: #f0f0f0; }
.cover-img { width: 100%; height: 100%; object-fit: cover; }
.cover-placeholder {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #e8f0fe, #d2e3fc);
}
.cover-icon { font-size: 36px; color: #1a73e8; font-weight: 700; }

.card-body {
  padding: 16px; display: flex; flex-direction: column; justify-content: space-between;
}
.card-meta { display: flex; justify-content: space-between; align-items: center; }
.card-type { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #e8f0fe; color: #1a73e8; font-weight: 500; }
.card-date { font-size: 12px; color: #999; }
.card-title { margin: 8px 0; font-size: 15px; font-weight: 600; color: #202124; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-preview { margin: 0; font-size: 13px; color: #5f6368; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex: 1; }
.card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
.card-author { font-size: 12px; color: #1a73e8; }
.card-stats { font-size: 12px; color: #999; display: flex; gap: 10px; }
</style>
