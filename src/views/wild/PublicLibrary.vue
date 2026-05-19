<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import type { PublishedArticle } from '@/types'

const router = useRouter()
const articles = ref<PublishedArticle[]>([])
const isLoading = ref(false)

const typeLabel: Record<string, string> = { NOVEL: '小说', ESSAY: '散文' }

async function loadArticles() {
  isLoading.value = true
  try {
    const res = await http.get<PublishedArticle[]>('/articles/published')
    articles.value = res.data || []
  } catch { /* */ }
  finally { isLoading.value = false }
}

function goToArticle(id: number) {
  router.push(`/wild/library/${id}`)
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('zh-CN')

onMounted(loadArticles)
</script>

<template>
  <div class="library-page">
    <div class="page-header">
      <h2 class="page-title">文阁</h2>
      <span class="page-subtitle">已发布的小说与散文</span>
    </div>

    <div v-if="isLoading" class="loading-state">加载中...</div>

    <div v-else-if="articles.length === 0" class="empty-state">
      <div class="empty-icon">📚</div>
      <div class="empty-text">还没有发布的作品，去创作中心发布你的作品吧</div>
    </div>

    <div v-else class="library-grid">
      <article
        v-for="a in articles"
        :key="a.id"
        class="library-card"
        @click="goToArticle(a.id)"
      >
        <div class="lib-card-top">
          <span class="lib-type" :class="a.type === 'NOVEL' ? 'novel' : 'essay'">
            {{ typeLabel[a.type] || a.type }}
          </span>
          <span class="lib-words">{{ a.wordCount || 0 }} 字</span>
        </div>
        <h3 class="lib-title">{{ a.title }}</h3>
        <p v-if="a.body" class="lib-preview">{{ a.body.substring(0, 150) }}{{ a.body.length > 150 ? '...' : '' }}</p>
        <div class="lib-footer">
          <span class="lib-author">👤 {{ a.authorName || '匿名' }}</span>
          <span v-if="a.publishedAt" class="lib-date">{{ formatDate(a.publishedAt) }}</span>
          <span v-if="a.worldName" class="lib-world">📖 {{ a.worldName }}</span>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.library-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 24px;
}
.page-header { margin-bottom: 24px; }
.page-title { font-size: 22px; font-weight: 700; color: #202124; margin: 0; }
.page-subtitle { font-size: 13px; color: #999; display: block; margin-top: 4px; }

.loading-state { text-align: center; padding: 60px; color: #999; }
.empty-state { text-align: center; padding: 60px 20px; color: #999; }
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.empty-text { font-size: 14px; }

.library-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}
.library-card {
  background: #fff; border-radius: 14px; padding: 28px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05); border: 1px solid #f1f3f4;
  cursor: pointer; transition: all 0.2s;
}
.library-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1); border-color: #d2e3fc;
}
.lib-card-top { display: flex; justify-content: space-between; margin-bottom: 14px; }
.lib-type {
  font-size: 13px; padding: 4px 12px; border-radius: 6px; font-weight: 500;
}
.lib-type.novel { background: #fce8e6; color: #c5221f; }
.lib-type.essay { background: #e6f4ea; color: #137333; }
.lib-words { font-size: 13px; color: #999; }
.lib-title { font-size: 20px; font-weight: 700; color: #202124; margin: 0 0 12px 0; }
.lib-preview {
  font-size: 14px; color: #5f6368; line-height: 1.6; margin: 0 0 16px 0;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.lib-footer { display: flex; gap: 16px; font-size: 13px; color: #5f6368; flex-wrap: wrap; }
.lib-author { color: #333; }
.lib-date { color: #999; }
.lib-world { color: #1a73e8; }

@media (max-width: 860px) {
  .library-grid { grid-template-columns: 1fr; }
}
</style>
