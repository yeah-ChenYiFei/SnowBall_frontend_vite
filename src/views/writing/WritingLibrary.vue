<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import type { Article, ArticleType } from '@/types'
import { ArticleTypeLabel } from '@/types'

const router = useRouter()
const articles = ref<Article[]>([])
const isLoading = ref(false)

interface BookItem {
  id: string
  type: string
  title: string
  entryId: number
  wordCount: number
  chapterCount?: number
  description?: string
  createdAt: string
  updatedAt?: string
  navigateTo: string
}

const libraryArticles = ref<BookItem[]>([])

async function loadArticles() {
  isLoading.value = true
  try {
    const [articleRes, novelRes] = await Promise.all([
      http.get('/articles', { params: { type: 'ESSAY' } }),
      http.get('/novels').catch(() => ({ data: [] })),
    ])
    const essayList = (articleRes.data || []) as Article[]
    const novelList = (novelRes.data || []) as any[]

    const items: BookItem[] = []

    for (const a of essayList) {
      items.push({
        id: `essay:${a.id}`,
        type: a.type,
        title: a.title,
        entryId: a.id,
        wordCount: a.wordCount || 0,
        createdAt: a.createdAt,
        navigateTo: `/writing/${a.id}`,
      })
    }

    for (const n of novelList) {
      items.push({
        id: `novel:${n.id}`,
        type: 'NOVEL',
        title: n.title,
        entryId: n.id,
        wordCount: n.totalWordCount || 0,
        chapterCount: n.chapterCount,
        description: n.description,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        navigateTo: `/writing/${n.id}?novelId=${n.id}`,
      })
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    libraryArticles.value = items
  } catch {
    // silent
  } finally {
    isLoading.value = false
  }
}

function goToArticle(item: BookItem) {
  router.push(item.navigateTo)
}

function goBack() {
  router.push('/writing')
}

const typeBadgeClass = (type: ArticleType) => ({
  'type-badge': true,
  'type-essay': type === 'ESSAY',
  'type-novel': type === 'NOVEL',
})

onMounted(loadArticles)
</script>

<template>
  <div class="writing-library">
    <div class="library-header">
      <button class="btn-back" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        返回
      </button>
      <h1 class="library-title">文库</h1>
      <div class="header-spacer"></div>
    </div>

    <div v-if="isLoading" class="loading-state">加载中...</div>

    <div v-else-if="libraryArticles.length === 0" class="empty-state">
      <p>还没有文章，去创作中心写一篇吧</p>
    </div>

    <div v-else class="article-list">
      <div
        v-for="item in libraryArticles"
        :key="item.id"
        class="article-row"
        @click="goToArticle(item)"
      >
        <div class="row-main">
          <h3 class="row-title">{{ item.title }}</h3>
          <div class="row-meta">
            <span :class="typeBadgeClass(item.type as ArticleType)">
              {{ ArticleTypeLabel[item.type as ArticleType] || item.type }}
            </span>
            <span v-if="item.chapterCount" class="row-chapters">{{ item.chapterCount }} 章</span>
            <span class="row-date">{{ new Date(item.createdAt).toLocaleDateString('zh-CN') }}</span>
            <span v-if="item.updatedAt && item.updatedAt !== item.createdAt" class="row-date">
              更新于 {{ new Date(item.updatedAt).toLocaleDateString('zh-CN') }}
            </span>
          </div>
        </div>
        <div class="row-words">
          <span class="words-num">{{ item.wordCount || 0 }}</span>
          <span class="words-label">字</span>
        </div>
        <div class="row-arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#bdc1c6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.writing-library {
  max-width: 740px;
  margin: 0 auto;
  padding: 20px;
}

.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #5f6368;
  font-size: 14px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 0.2s;
}

.btn-back:hover {
  color: #1a73e8;
  background: #e8f0fe;
}

.library-title {
  font-size: 22px;
  font-weight: 700;
  color: #202124;
  margin: 0;
}

.header-spacer {
  width: 70px;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 60px;
  color: #999;
}

.article-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.article-row {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #ffffff;
  padding: 20px 24px;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.2s;
}

.article-row:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-title {
  font-size: 16px;
  font-weight: 600;
  color: #202124;
  margin: 0 0 8px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.type-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 10px;
  border-radius: 10px;
}

.type-essay {
  background: #e8f0fe;
  color: #1a73e8;
}

.type-novel {
  background: #e6f4ea;
  color: #1e8e3e;
}

.row-date {
  font-size: 13px;
  color: #999;
}

.row-words {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 48px;
}

.words-num {
  font-size: 18px;
  font-weight: 600;
  color: #5f6368;
}

.words-label {
  font-size: 11px;
  color: #999;
}

.row-arrow {
  display: flex;
  align-items: center;
}
</style>
