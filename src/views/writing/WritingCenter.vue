<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import type { Article, ArticleType } from '@/types'
import { ArticleTypeLabel } from '@/types'

interface CardItem {
  id: number; type: string; title: string; body: string; wordCount: number; createdAt: string
}

const router = useRouter()
const articles = ref<Article[]>([])

// ============ Carousel ============
const currentIndex = ref(0)
const isLoading = ref(false)
const isAnimating = ref(false)
const direction = ref<'left' | 'right'>('right')
let autoTimer: ReturnType<typeof setInterval> | null = null

const articleList = computed(() => {
  const filtered = articles.value.filter(a => ['ESSAY', 'DIARY'].includes(a.type))
  return filtered.map(a => ({
    id: a.id, type: a.type, title: a.title, body: a.body || '',
    wordCount: a.wordCount || 0, createdAt: a.createdAt,
  }))
})

// Pad with placeholders to always have 4 visible cards for the carousel
const paddedArticleList = computed(() => {
  const real = articleList.value
  if (real.length >= 4) return real
  const pad: CardItem[] = []
  for (let i = 0; i < 4 - real.length; i++) {
    pad.push({ id: -1 - i, type: 'placeholder', title: '', body: '', wordCount: 0, createdAt: '' })
  }
  return [...real, ...pad]
})

const hoveredCardId = ref<number | null>(null)
const hoveredPosition = ref<'left' | 'center' | 'right' | 'behind' | null>(null)

const visibleCards = computed(() => {
  const list = paddedArticleList.value
  if (list.length === 0) return []
  const seen = new Set<number>()
  const cards: { item: CardItem; position: 'behind' | 'left' | 'center' | 'right' }[] = []
  const add = (idx: number, pos: 'behind' | 'left' | 'center' | 'right') => {
    const item = list[idx]
    if (!seen.has(item.id)) { seen.add(item.id); cards.push({ item, position: pos }) }
  }
  add(currentIndex.value, 'center')
  const len = list.length
  if (len >= 2) add((currentIndex.value - 1 + len) % len, 'left')
  if (len >= 3) add((currentIndex.value + 1) % len, 'right')
  if (len >= 4) add((currentIndex.value - 2 + len) % len, 'behind')
  return cards
})

function rotate(dir: 'left' | 'right') {
  if (isAnimating.value || paddedArticleList.value.length <= 1) return
  isAnimating.value = true; direction.value = dir
  const len = paddedArticleList.value.length
  if (dir === 'right') currentIndex.value = (currentIndex.value + 1) % len
  else currentIndex.value = (currentIndex.value - 1 + len) % len
  setTimeout(() => { isAnimating.value = false }, 500)
}
function goToCard(item: CardItem) { if (item.id > 0) router.push(`/writing/${item.id}`) }
function startAutoRotate() { stopAutoRotate(); if (paddedArticleList.value.length > 1) autoTimer = setInterval(() => rotate('right'), 5000) }
function stopAutoRotate() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null } }

async function loadArticles() {
  isLoading.value = true
  try {
    const res = await http.get('/articles', { params: { type: 'ESSAY,DIARY' } })
    articles.value = (res.data || []) as Article[]
  } catch { /* */ } finally { isLoading.value = false }
}

// ============ Inspiration Side Bubbles ============
const inspirations = ref<any[]>([])
const isLoadingInsp = ref(false)

async function loadInspirations() {
  isLoadingInsp.value = true
  try {
    const res = await http.get('/inspirations')
    inspirations.value = (res.data || []) as any[]
  } catch { /* */ } finally { isLoadingInsp.value = false }
}

function formatBubbleDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} `
}

// Split inspirations: evens go left, odds go right, duplicated for seamless loop
const bubbleLeft = computed(() => inspirations.value.filter((_: any, i: number) => i % 2 === 0))
const bubbleRight = computed(() => inspirations.value.filter((_: any, i: number) => i % 2 === 1))
const bubbleListLeft = computed(() => [...bubbleLeft.value, ...bubbleLeft.value])
const bubbleListRight = computed(() => [...bubbleRight.value, ...bubbleRight.value])
const scrollDuration = computed(() => Math.max(Math.max(bubbleLeft.value.length, bubbleRight.value.length) * 8, 20))

// ============ Inspiration Modal ============
const showInspModal = ref(false)
const newInspContent = ref('')
const isSubmittingInsp = ref(false)

function openInspModal() { newInspContent.value = ''; showInspModal.value = true }
function closeInspModal() { showInspModal.value = false }

async function submitInspiration() {
  const content = newInspContent.value.trim()
  if (!content) return
  isSubmittingInsp.value = true
  try {
    const res = await http.post('/inspirations', { content })
    inspirations.value.unshift(res.data as any)
    closeInspModal()
  } catch (e: any) { alert(e.message || '记录失败') } finally {
    isSubmittingInsp.value = false
  }
}

// ============ Lifecycle ============
onMounted(async () => {
  await Promise.all([loadArticles(), loadInspirations()])
  await nextTick()
  startAutoRotate()
})

onUnmounted(() => { stopAutoRotate() })

watch(articleList, (val) => {
  if (val.length > 1 && !autoTimer) startAutoRotate()
})

const typeBadgeClass = (type: ArticleType) => ({
  'type-badge': true,
  'type-essay': type === 'ESSAY',
  'type-diary': type === 'DIARY',
})
</script>

<template>
  <div class="writing-center">
    <div class="content-box">
      <!-- ===== THREE-COLUMN: Left bubbles | Carousel | Right bubbles ===== -->
      <div class="hero-zone">
      <!-- Left bubbles -->
      <div class="bubble-col bubble-col-left">
        <div v-if="inspirations.length > 0" class="bubble-stage">
          <div class="bubble-track bubble-track-up" :style="{ animationDuration: scrollDuration + 's' }">
            <div v-for="(item, idx) in bubbleListLeft" :key="'l'+idx" class="bubble">
              <div class="bubble-date">{{ formatBubbleDate(item.createdAt) }}</div>
              <div class="bubble-content">{{ item.content }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Center: title + carousel -->
      <div class="carousel-col">

        <div v-if="!isLoading" class="carousel-container"
          @mouseenter="stopAutoRotate"
          @mouseleave="startAutoRotate">
          <div class="cards-deck"
               :class="{ 'anim-left': isAnimating && direction === 'left', 'anim-right': isAnimating && direction === 'right' }">
            <div
              v-for="card in visibleCards"
              :key="card.item.id + '-' + card.item.type"
              :class="['article-card', `card-${card.position}`, { 'card-placeholder': card.item.type === 'placeholder' },
                { 'card-hovered': hoveredCardId === card.item.id && card.item.type !== 'placeholder' },
                { 'card-semi-dimmed': hoveredCardId !== null && hoveredCardId !== card.item.id && card.position === 'center' && hoveredPosition !== 'center' },
                { 'card-full-dimmed': hoveredCardId !== null && hoveredCardId !== card.item.id && !(card.position === 'center' && hoveredPosition !== 'center') },
              ]"
              @click="goToCard(card.item)"
              @mouseenter="if(card.item.type !== 'placeholder') { hoveredCardId = card.item.id; hoveredPosition = card.position }"
              @mouseleave="hoveredCardId = null; hoveredPosition = null"
            >
              <div class="card-inner">
                <div class="card-type-row">
                  <span :class="typeBadgeClass(card.item.type as ArticleType)">
                    {{ ArticleTypeLabel[card.item.type as ArticleType] || card.item.type }}
                  </span>
                </div>
                <h3 class="card-title">{{ card.item.title }}</h3>
                <p class="card-body">
                  {{ card.item.body?.substring(0, 200) }}{{ (card.item.body?.length || 0) > 200 ? '...' : '' }}
                </p>
                <div class="card-footer">
                  <span class="card-date">{{ new Date(card.item.createdAt).toLocaleDateString('zh-CN') }}</span>
                  <span v-if="card.item.wordCount" class="card-words">{{ card.item.wordCount }} 字</span>
                </div>
              </div>
            </div>
          </div>

          <button class="carousel-arrow carousel-arrow-left" @click="rotate('left'); startAutoRotate()" :disabled="isAnimating">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button class="carousel-arrow carousel-arrow-right" @click="rotate('right'); startAutoRotate()" :disabled="isAnimating">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div v-else-if="isLoading" class="loading-state">加载中...</div>
        <div v-else class="carousel-empty">
          <span class="empty-icon-small">📝</span>
          <span>暂无文章</span>
        </div>
      </div>

      <!-- Right bubbles -->
      <div class="bubble-col bubble-col-right">
        <div v-if="inspirations.length > 0" class="bubble-stage">
          <div class="bubble-track bubble-track-up" :style="{ animationDuration: scrollDuration + 's' }">
            <div v-for="(item, idx) in bubbleListRight" :key="'r'+idx" class="bubble">
              <div class="bubble-date">{{ formatBubbleDate(item.createdAt) }}</div>
              <div class="bubble-content">{{ item.content }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty inspirations hint (shown outside hero-zone when no inspirations) -->
    <div v-if="inspirations.length === 0 && !isLoadingInsp" class="insp-empty">
      <span class="empty-icon">✨</span>
      <span class="empty-text">还没有灵感，点击下方按钮记录第一个吧</span>
    </div>

    <h1 class="page-title">闲言碎语</h1>

    <!-- ===== ACTION BUTTONS ===== -->
    <div class="action-bar">
      <button class="action-btn" @click="openInspModal">
        <span class="action-icon">💡</span><span>记录灵感</span>
      </button>
      <button class="action-btn" @click="router.push('/writing/essay/new')">
        <span class="action-icon">📝</span><span>写散文</span>
      </button>
      <button class="action-btn" @click="router.push('/writing/diary/new')">
        <span class="action-icon">📅</span><span>写日记</span>
      </button>
      <button class="action-btn" @click="router.push('/writing/shards')">
        <span class="action-icon">🧩</span><span>碎片拾取</span>
      </button>
    </div>

    <!-- ===== INSPIRATION MODAL ===== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showInspModal" class="modal-overlay" @click.self="closeInspModal">
          <div class="modal-card">
            <h2 class="modal-title">记录灵感</h2>
            <textarea v-model="newInspContent" class="modal-textarea" placeholder="捕捉此刻灵感..." rows="4" autofocus></textarea>
            <div class="modal-actions">
              <button class="btn-cancel" @click="closeInspModal">取消</button>
              <button class="btn-submit" :disabled="!newInspContent.trim() || isSubmittingInsp" @click="submitInspiration">
                {{ isSubmittingInsp ? '记录中...' : '记录' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    </div><!-- /content-box -->
  </div>
</template>

<style scoped>
.writing-center { max-width: 1200px; margin: 0 auto; padding: 28px 12px; }

/* ===== PAGE TITLE (between hero and action bar) ===== */
.page-title {
  text-align: center; font-size: 28px; font-weight: 700;
  color: #202124; letter-spacing: 2px; margin: 0 0 80px 0;
}

/* ===== CONTENT BOX ===== */
.content-box {
  display: flex; flex-direction: column; gap: 4px;
}

/* ===== HERO ZONE: 3 columns ===== */
.hero-zone {
  display: grid;
  grid-template-columns: 0.85fr 2.5fr 0.85fr;
  gap: 8px;
  align-items: start;
  min-height: 390px;
}

/* ===== INSPIRATION SIDE COLUMNS ===== */
.bubble-col { overflow: hidden; height: 390px; }

.bubble-stage {
  height: 100%; overflow: hidden; position: relative;
  mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 6%, black 14%, black 86%, rgba(0,0,0,0.3) 94%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 6%, black 14%, black 86%, rgba(0,0,0,0.3) 94%, transparent 100%);
}

.bubble-track { display: flex; flex-direction: column; animation-timing-function: linear; animation-iteration-count: infinite; }
.bubble-track-up { animation-name: float-up; }

@keyframes float-up { from { transform: translateY(0); } to { transform: translateY(-50%); } }


.bubble { margin-bottom: 14px; }

.bubble-date { font-size: 12px; color: #9aa0a6; margin-bottom: 4px; padding: 0 4px; }

.bubble-content {
  padding: 12px 16px; border-radius: 16px; font-size: 14px;
  line-height: 1.7; color: #202124; word-break: break-word;
}

.bubble-col-left .bubble-content { background: #ede9fe; border-bottom-left-radius: 4px; }
.bubble-col-left .bubble-date { text-align: left; }
.bubble-col-right .bubble-content { background: #ede9fe; border-bottom-right-radius: 4px; }
.bubble-col-right .bubble-date { text-align: right; }

/* ===== CENTER CAROUSEL ===== */
.carousel-col { display: flex; flex-direction: column; align-items: center; }
.carousel-container {
  position: relative; display: flex; align-items: center; justify-content: center;
  width: 100%; height: 310px;
}
.carousel-empty { text-align: center; padding: 80px 0; color: #999; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty-icon-small { font-size: 36px; }
.loading-state { text-align: center; color: #999; padding: 80px 0; width: 100%; }

.cards-deck { position: relative; width: 480px; height: 310px; perspective: 1000px; }

.article-card {
  position: absolute; width: 400px; height: 290px; top: 10px; left: 50%;
  transform-origin: center center;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), filter 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: default;
}
.card-center { transform: translateX(-50%) translateZ(0) scale(1); z-index: 3; opacity: 1; filter: brightness(1); cursor: pointer; }
.card-left { transform: translateX(calc(-50% - 250px)) translateZ(-100px) rotateY(16deg) scale(0.85); z-index: 2; opacity: 0.6; filter: brightness(0.65); }
.card-right { transform: translateX(calc(-50% + 250px)) translateZ(-100px) rotateY(-16deg) scale(0.85); z-index: 2; opacity: 0.6; filter: brightness(0.65); }
.card-behind { transform: translateX(-50%) translateZ(-200px) rotateY(0deg) scale(0.6); z-index: 1; opacity: 0.2; filter: brightness(0.35); }

.card-hovered { z-index: 100 !important; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s, filter 0.3s; filter: brightness(1.1) !important; cursor: pointer; }
.card-hovered.card-behind { transform: translateX(-50%) translateZ(-80px) scale(0.78) !important; opacity: 0.75 !important; }
.card-hovered.card-left { transform: translateX(calc(-50% - 250px)) translateZ(-30px) rotateY(8deg) scale(0.92) !important; opacity: 0.95 !important; }
.card-hovered.card-right { transform: translateX(calc(-50% + 250px)) translateZ(-30px) rotateY(-8deg) scale(0.92) !important; opacity: 0.95 !important; }
.card-hovered.card-center { transform: translateX(-50%) translateZ(30px) scale(1.05) !important; }
.card-semi-dimmed { filter: brightness(0.85) !important; transition: filter 0.3s; }
.card-full-dimmed { filter: grayscale(0.6) brightness(0.7) !important; transition: filter 0.3s; }

.card-inner {
  background: #fff; border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
  padding: 28px 24px; height: 100%; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box;
}
.card-type-row { margin-bottom: 12px; }
.type-badge { display: inline-block; font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 12px; letter-spacing: 1px; }
.type-essay { background: #e6f4ea; color: #137333; }
.type-diary { background: #fce8e6; color: #d93025; }
.card-title { font-size: 18px; font-weight: 700; color: #202124; margin: 0 0 8px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-body { flex: 1; font-size: 14px; color: #5f6368; line-height: 1.7; margin: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; word-break: break-all; }
.card-footer { display: flex; justify-content: space-between; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e8eaed; }
.card-date { font-size: 12px; color: #999; }
.card-words { font-size: 12px; color: #999; }

/* Placeholder cards */
.card-placeholder { cursor: default; }
.card-placeholder .card-inner {
  background: #fafafa; border: 2px dashed #e0e0e0; box-shadow: none;
  display: flex; align-items: center; justify-content: center;
}
.card-placeholder .card-inner::after {
  content: '写下你的第一篇文章 ✨';
  color: #c0c0c0; font-size: 15px; font-weight: 400;
}

.carousel-arrow {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 10;
  width: 44px; height: 44px; border-radius: 50%; border: 1px solid #dadce0;
  background: #fff; color: #5f6368; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.carousel-arrow:hover:not(:disabled) { background: #e8f0fe; color: #1a73e8; border-color: #1a73e8; }
.carousel-arrow:disabled { opacity: 0.5; cursor: not-allowed; }
.carousel-arrow-left { left: -6px; }
.carousel-arrow-right { right: -6px; }

/* ===== EMPTY INSPIRATIONS ===== */
.insp-empty { text-align: center; padding: 8px 0 20px; color: #999; }
.empty-icon { font-size: 32px; margin-bottom: 6px; }
.empty-text { font-size: 13px; }

/* ===== ACTION BAR ===== */
.action-bar { display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; }
.action-btn {
  display: flex; align-items: center; gap: 6px; padding: 12px 26px;
  border-radius: 12px; font-size: 14px; font-weight: 500; cursor: pointer;
  border: 1px solid #dadce0; background: #fff; color: #5f6368;
  transition: all 0.2s; font-family: inherit;
}
.action-btn:hover { background: #f8f9fa; color: #202124; border-color: #bdc1c6; }
.action-icon { font-size: 17px; }

/* ===== MODAL ===== */
.modal-overlay {
  position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; padding: 24px;
  backdrop-filter: blur(4px);
}
.modal-card { background: #fff; border-radius: 16px; padding: 28px 24px 20px; width: 100%; max-width: 460px; box-shadow: 0 16px 48px rgba(0,0,0,0.15); }
.modal-title { font-size: 20px; font-weight: 600; color: #202124; margin: 0 0 18px 0; text-align: center; }
.modal-textarea {
  width: 100%; border: 1px solid #dadce0; border-radius: 10px; padding: 14px;
  font-size: 15px; line-height: 1.6; color: #202124; resize: vertical;
  font-family: inherit; outline: none; box-sizing: border-box; transition: border-color 0.2s;
}
.modal-textarea:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,0.12); }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; }
.btn-cancel { padding: 10px 22px; background: #fff; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; color: #5f6368; cursor: pointer; font-family: inherit; }
.btn-cancel:hover { background: #f1f3f4; }
.btn-submit { padding: 10px 26px; background: #1a73e8; border: none; border-radius: 8px; font-size: 14px; color: #fff; cursor: pointer; font-weight: 500; font-family: inherit; }
.btn-submit:hover:not(:disabled) { background: #1557b0; }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-enter-active { transition: opacity 0.25s ease; }
.modal-enter-active .modal-card { transition: transform 0.3s ease, opacity 0.25s ease; }
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-leave-active .modal-card { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .modal-card { transform: scale(0.92) translateY(20px); opacity: 0; }
.modal-leave-to { opacity: 0; }
.modal-leave-to .modal-card { transform: scale(0.95); opacity: 0; }

@media (max-width: 960px) {
  .hero-zone { grid-template-columns: 1fr; }
  .bubble-col { display: none; }
  .cards-deck { width: 400px; height: 340px; }
  .article-card { width: 340px; height: 260px; }
  .card-left { transform: translateX(calc(-50% - 210px)) translateZ(-80px) rotateY(12deg) scale(0.82); }
  .card-right { transform: translateX(calc(-50% + 210px)) translateZ(-80px) rotateY(-12deg) scale(0.82); }
  .card-hovered.card-left { transform: translateX(calc(-50% - 210px)) translateZ(-20px) rotateY(6deg) scale(0.9) !important; }
  .card-hovered.card-right { transform: translateX(calc(-50% + 210px)) translateZ(-20px) rotateY(-6deg) scale(0.9) !important; }
  .carousel-arrow-left { left: 8px; }
  .carousel-arrow-right { right: 8px; }
}

@media (max-width: 480px) {
  .hero-zone { min-height: 360px; }
  .cards-deck { width: 280px; height: 280px; }
  .article-card { width: 240px; height: 220px; }
  .card-left { transform: translateX(calc(-50% - 160px)) translateZ(-80px) rotateY(10deg) scale(0.8); }
  .card-right { transform: translateX(calc(-50% + 160px)) translateZ(-80px) rotateY(-10deg) scale(0.8); }
  .card-hovered.card-left { transform: translateX(calc(-50% - 160px)) translateZ(-20px) rotateY(5deg) scale(0.88) !important; }
  .card-hovered.card-right { transform: translateX(calc(-50% + 160px)) translateZ(-20px) rotateY(-5deg) scale(0.88) !important; }
  .card-inner { padding: 20px 16px; }
  .card-title { font-size: 16px; }
  .card-body { font-size: 13px; -webkit-line-clamp: 3; }
}
</style>
