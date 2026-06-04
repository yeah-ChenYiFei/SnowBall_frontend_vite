<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import type { PublishedArticle } from '@/types'

const route = useRoute()
const router = useRouter()
const userId = computed(() => Number(route.params.userId))

const articles = ref<PublishedArticle[]>([])
const isLoading = ref(true)
const authorName = ref('')

const typeLabel: Record<string, string> = {
  ESSAY: '散文', DIARY: '日记', NOVEL: '小说', POST: '帖子',
}

onMounted(async () => {
  try {
    const res = await http.get(`/users/${userId.value}/articles`)
    articles.value = (res.data as any[]) || []
    if (articles.value.length > 0) authorName.value = articles.value[0]?.authorName || ''
  } catch { articles.value = [] }
  finally { isLoading.value = false }
})

function goArticle(a: PublishedArticle) {
  if (a.type === 'NOVEL') router.push(`/wild/library/novel/${a.id}`)
  else router.push(`/wild/library/${a.id}`)
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('zh-CN')
</script>

<template>
  <div class="profile-articles-page">
    <button class="back-btn" @click="router.push(`/profile/${userId}`)">← 返回主页</button>
    <h2>{{ authorName ? `${authorName} 的文章` : '公开文章' }}</h2>
    <div v-if="isLoading" class="loading-state">加载中...</div>
    <div v-else-if="articles.length === 0" class="empty-state">暂无公开文章</div>
    <div v-else class="articles-grid">
      <div v-for="a in articles" :key="a.id" class="article-card" @click="goArticle(a)">
        <div class="article-type">{{ typeLabel[a.type] || a.type }}</div>
        <h3 class="article-title">{{ a.title }}</h3>
        <p v-if="a.body" class="article-preview">{{ a.body.substring(0, 120) }}</p>
        <div class="article-footer">
          <span v-if="a.wordCount">{{ a.wordCount }} 字</span>
          <span>{{ formatDate(a.publishedAt || a.createdAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-articles-page { max-width: 960px; margin: 0 auto; padding: 24px 20px; }
.back-btn { background: none; border: none; color: #1a73e8; cursor: pointer; font-size: 14px; padding: 4px 0; margin-bottom: 16px; display: inline-block; }
.back-btn:hover { text-decoration: underline; }
h2 { font-size: 20px; font-weight: 600; margin: 0 0 20px; color: #202124; }
.loading-state, .empty-state { text-align: center; padding: 60px; color: #999; font-size: 14px; }
.articles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.article-card {
  padding: 20px; border: 1px solid #e8eaed; border-radius: 12px;
  cursor: pointer; transition: all 0.15s; background: #fff;
}
.article-card:hover { border-color: #1a73e8; box-shadow: 0 2px 8px rgba(26,115,232,0.08); }
.article-type {
  display: inline-block; font-size: 11px; padding: 2px 8px;
  border-radius: 4px; background: #fef3c7; color: #d97706; margin-bottom: 8px;
}
.article-title { font-size: 16px; font-weight: 600; color: #202124; margin: 0 0 6px; }
.article-preview {
  font-size: 13px; color: #5f6368; line-height: 1.5; margin: 0 0 12px;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.article-footer { display: flex; justify-content: space-between; font-size: 12px; color: #999; }
</style>
