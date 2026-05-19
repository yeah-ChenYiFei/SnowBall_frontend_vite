<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import type { Article, ArticleType } from '@/types'
import { ArticleTypeLabel } from '@/types'

const router = useRouter()
const articles = ref<Article[]>([])
const currentIndex = ref(0)
const isLoading = ref(false)
const isAnimating = ref(false)
const direction = ref<'left' | 'right'>('right')
let autoTimer: ReturnType<typeof setInterval> | null = null

const articleList = computed(() =>
  articles.value.filter((a) =>
    ['ESSAY', 'DIARY', 'NOVEL'].includes(a.type),
  ),
)

const hoveredCardId = ref<number | null>(null)

const visibleCards = computed(() => {
  const list = articleList.value
  if (list.length === 0) return []
  const len = list.length
  const prevIdx = (currentIndex.value - 1 + len) % len
  const nextIdx = (currentIndex.value + 1) % len
  const behindIdx = (currentIndex.value - 2 + len) % len

  // Build card list, deduplicate by article id (handles len < 4)
  const seen = new Set<number>()
  const cards: { article: Article; position: 'behind' | 'left' | 'center' | 'right' }[] = []

  const addCard = (idx: number, pos: 'behind' | 'left' | 'center' | 'right') => {
    const article = list[idx]
    if (!seen.has(article.id)) {
      seen.add(article.id)
      cards.push({ article, position: pos })
    }
  }

  addCard(behindIdx, 'behind')
  addCard(prevIdx, 'left')
  addCard(currentIndex.value, 'center')
  addCard(nextIdx, 'right')

  return cards
})

function rotate(dir: 'left' | 'right') {
  if (isAnimating.value || articleList.value.length <= 1) return
  isAnimating.value = true
  direction.value = dir
  const len = articleList.value.length
  if (dir === 'right') {
    currentIndex.value = (currentIndex.value + 1) % len
  } else {
    currentIndex.value = (currentIndex.value - 1 + len) % len
  }
  setTimeout(() => {
    isAnimating.value = false
  }, 500)
}

function goToArticle(id: number) {
  router.push(`/writing/${id}`)
}

function startAutoRotate() {
  stopAutoRotate()
  autoTimer = setInterval(() => {
    rotate('right')
  }, 5000)
}

function stopAutoRotate() {
  if (autoTimer) {
    clearInterval(autoTimer)
    autoTimer = null
  }
}

function resetAutoRotate() {
  stopAutoRotate()
  startAutoRotate()
}

async function loadArticles() {
  isLoading.value = true
  try {
    const res = await http.get('/articles')
    articles.value = (res.data || []) as Article[]
  } catch {
    // silent fail, show empty state
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadArticles().then(() => {
    if (articleList.value.length > 1) {
      startAutoRotate()
    }
  })
})

onUnmounted(() => {
  stopAutoRotate()
})

watch(articleList, (val) => {
  if (val.length > 1 && !autoTimer) {
    startAutoRotate()
  }
})

const typeBadgeClass = (type: ArticleType) => ({
  'type-badge': true,
  'type-essay': type === 'ESSAY',
  'type-diary': type === 'DIARY',
  'type-novel': type === 'NOVEL',
})

function displayChapter(chapter?: string): string {
  if (!chapter) return ''
  const cleaned = chapter.replace(/\$\$cfg:[^$]*\$\$/g, '').trim()
  return cleaned && !cleaned.startsWith('$$') ? cleaned : ''
}
</script>

<template>
  <div class="writing-center">
    <h1 class="page-title">创作中心</h1>

    <!-- Carousel Area -->
    <div
      class="carousel-container"
      @mouseenter="stopAutoRotate"
      @mouseleave="startAutoRotate"
    >
      <div v-if="isLoading" class="loading-state">加载中...</div>

      <div v-else-if="articleList.length === 0" class="empty-state">
        <div class="empty-icon">📝</div>
        <p>还没有文章，点击下方按钮开始创作吧</p>
      </div>

      <template v-else>
        <!-- Left Arrow -->
        <button
          class="carousel-arrow carousel-arrow-left"
          @click="resetAutoRotate(); rotate('left')"
          :disabled="isAnimating"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <!-- Cards Deck -->
        <div class="cards-deck" :class="{ 'anim-left': isAnimating && direction === 'left', 'anim-right': isAnimating && direction === 'right' }">
          <div
            v-for="card in visibleCards"
            :key="card.article.id"
            :class="[
              'article-card',
              `card-${card.position}`,
              { 'card-hovered': hoveredCardId === card.article.id },
              { 'card-dimmed': hoveredCardId !== null && hoveredCardId !== card.article.id },
            ]"
            @click="card.position === 'center' && goToArticle(card.article.id)"
            @mouseenter="hoveredCardId = card.article.id"
            @mouseleave="hoveredCardId = null"
          >
            <div class="card-inner">
              <div class="card-type-row">
                <span :class="typeBadgeClass(card.article.type as ArticleType)">
                  {{ ArticleTypeLabel[card.article.type as ArticleType] || card.article.type }}
                </span>
              </div>
              <h3 class="card-title">{{ card.article.title }}</h3>
              <p v-if="displayChapter(card.article.chapter)" class="card-chapter">{{ displayChapter(card.article.chapter) }}</p>
              <p class="card-body">
                {{ card.article.body?.substring(0, 180) }}{{ card.article.body?.length > 180 ? '...' : '' }}
              </p>
              <div class="card-footer">
                <span class="card-date">{{ new Date(card.article.createdAt).toLocaleDateString('zh-CN') }}</span>
                <span v-if="card.article.wordCount" class="card-words">{{ card.article.wordCount }} 字</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Arrow -->
        <button
          class="carousel-arrow carousel-arrow-right"
          @click="resetAutoRotate(); rotate('right')"
          :disabled="isAnimating"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </template>
    </div>

    <!-- Bottom Action Buttons -->
    <div class="action-bar">
      <button class="action-btn action-btn-secondary" @click="router.push('/writing/library')">
        <span class="action-icon">📚</span>
        <span>文库</span>
      </button>
      <button class="action-btn action-btn-primary" @click="router.push('/writing/new')">
        <span class="action-icon">✏️</span>
        <span>新文章</span>
      </button>
      <button class="action-btn action-btn-secondary" @click="router.push('/writing/diary')">
        <span class="action-icon">📅</span>
        <span>日记区</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.writing-center {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.page-title {
  text-align: center;
  font-size: 28px;
  font-weight: 700;
  color: #202124;
  margin-bottom: 40px;
  letter-spacing: 2px;
}

/* Carousel */
.carousel-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 420px;
  margin-bottom: 48px;
}

.loading-state,
.empty-state {
  text-align: center;
  color: #999;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

/* Cards Deck */
.cards-deck {
  position: relative;
  width: 520px;
  height: 380px;
  perspective: 1200px;
}

.article-card {
  position: absolute;
  width: 440px;
  height: 340px;
  top: 20px;
  left: 50%;
  transform-origin: center center;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), filter 0.5s cubic-bezier(0.4, 0, 0.2, 1), z-index 0s;
  cursor: default;
}

/* ---- Positions ---- */

/* Center */
.card-center {
  transform: translateX(-50%) translateZ(0) scale(1);
  z-index: 3;
  opacity: 1;
  filter: brightness(1);
  cursor: pointer;
}

/* Left */
.card-left {
  transform: translateX(calc(-50% - 280px)) translateZ(-100px) rotateY(18deg) scale(0.88);
  z-index: 2;
  opacity: 0.7;
  filter: brightness(0.75);
}

/* Right */
.card-right {
  transform: translateX(calc(-50% + 280px)) translateZ(-100px) rotateY(-18deg) scale(0.88);
  z-index: 2;
  opacity: 0.7;
  filter: brightness(0.75);
}

/* Behind */
.card-behind {
  transform: translateX(-50%) translateZ(-200px) rotateY(0deg) scale(0.64);
  z-index: 1;
  opacity: 0.3;
  filter: brightness(0.45);
}

/* ---- Hover: card pops to front so it's not blocked by center card ---- */
.card-hovered {
  z-index: 100 !important;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), filter 0.3s cubic-bezier(0.4, 0, 0.2, 1), z-index 0s;
  filter: brightness(1.1) !important;
  cursor: pointer;
}

.card-hovered.card-behind {
  transform: translateX(-50%) translateZ(-80px) scale(0.78) !important;
  opacity: 0.75 !important;
}

.card-hovered.card-left {
  transform: translateX(calc(-50% - 280px)) translateZ(-30px) rotateY(10deg) scale(0.94) !important;
  opacity: 0.95 !important;
}

.card-hovered.card-right {
  transform: translateX(calc(-50% + 280px)) translateZ(-30px) rotateY(-10deg) scale(0.94) !important;
  opacity: 0.95 !important;
}

.card-hovered.card-center {
  transform: translateX(-50%) translateZ(30px) scale(1.06) !important;
}

/* Dim all non-hovered cards when any card is hovered */
.card-dimmed {
  filter: grayscale(0.6) brightness(0.7) !important;
  transition: filter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Card inner */
.card-inner {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04);
  padding: 32px 28px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.card-type-row {
  margin-bottom: 16px;
}

.type-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 12px;
  letter-spacing: 1px;
}

.type-essay {
  background: #e8f0fe;
  color: #1a73e8;
}

.type-diary {
  background: #fce8e6;
  color: #d93025;
}

.type-novel {
  background: #e6f4ea;
  color: #1e8e3e;
}

.card-title {
  font-size: 20px;
  font-weight: 700;
  color: #202124;
  margin: 0 0 8px 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-chapter {
  font-size: 14px;
  color: #1a73e8;
  margin: 0 0 10px 0;
  font-weight: 500;
}

.card-body {
  flex: 1;
  font-size: 14px;
  color: #5f6368;
  line-height: 1.8;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  word-break: break-all;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #e8eaed;
}

.card-date {
  font-size: 13px;
  color: #999;
}

.card-words {
  font-size: 13px;
  color: #999;
}

/* Arrow buttons */
.carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid #dadce0;
  background: #ffffff;
  color: #5f6368;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.carousel-arrow:hover:not(:disabled) {
  background: #e8f0fe;
  color: #1a73e8;
  border-color: #1a73e8;
}

.carousel-arrow:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.carousel-arrow-left {
  left: 0;
}

.carousel-arrow-right {
  right: 0;
}

/* Action Bar */
.action-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 32px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.25s;
}

.action-btn-primary {
  background: #1a73e8;
  color: #ffffff;
  box-shadow: 0 2px 12px rgba(26, 115, 232, 0.3);
}

.action-btn-primary:hover {
  background: #1557b0;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(26, 115, 232, 0.4);
}

.action-btn-secondary {
  background: #ffffff;
  color: #5f6368;
  border: 1px solid #dadce0;
}

.action-btn-secondary:hover {
  background: #f8f9fa;
  color: #202124;
  border-color: #bdc1c6;
}

.action-icon {
  font-size: 18px;
}
</style>
