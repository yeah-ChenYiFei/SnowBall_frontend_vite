<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import type { Article } from '@/types'

const router = useRouter()
const articles = ref<Article[]>([])
const isLoading = ref(false)

const diaries = computed(() =>
  articles.value
    .filter((a) => a.type === 'DIARY')
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
)

// Group diaries by year-month
const diaryGroups = computed(() => {
  const groups: { label: string; items: typeof diaries.value }[] = []
  const seen = new Set<string>()

  for (const diary of diaries.value) {
    const date = new Date(diary.createdAt)
    const key = `${date.getFullYear()}年${date.getMonth() + 1}月`
    if (!seen.has(key)) {
      seen.add(key)
      groups.push({ label: key, items: [] })
    }
    groups[groups.length - 1].items.push(diary)
  }

  return groups
})

function formatDay(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getDate()}日`
}

function formatWeekday(dateStr: string) {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `星期${weekdays[new Date(dateStr).getDay()]}`
}

async function loadArticles() {
  isLoading.value = true
  try {
    const res = await http.get('/articles', { params: { type: 'DIARY' } })
    articles.value = (res.data || []) as Article[]
  } catch {
    // silent
  } finally {
    isLoading.value = false
  }
}

function goToArticle(id: number) {
  router.push(`/writing/${id}`)
}

function goBack() {
  router.push('/writing')
}

onMounted(loadArticles)
</script>

<template>
  <div class="writing-diary">
    <div class="diary-header">
      <button class="btn-back" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        返回
      </button>
      <h1 class="diary-title">日记区</h1>
      <div class="header-spacer"></div>
    </div>

    <div v-if="isLoading" class="loading-state">加载中...</div>

    <div v-else-if="diaries.length === 0" class="empty-state">
      <p>还没有日记，去创作中心写一篇吧</p>
    </div>

    <div v-else class="timeline">
      <div
        v-for="group in diaryGroups"
        :key="group.label"
        class="timeline-group"
      >
        <div class="timeline-month">{{ group.label }}</div>
        <div class="timeline-items">
          <div
            v-for="diary in group.items"
            :key="diary.id"
            class="timeline-item"
            @click="goToArticle(diary.id)"
          >
            <div class="timeline-dot-wrapper">
              <div class="timeline-dot"></div>
              <div class="timeline-line"></div>
            </div>
            <div class="timeline-content">
              <div class="timeline-date">
                <span class="date-day">{{ formatDay(diary.createdAt) }}</span>
                <span class="date-weekday">{{ formatWeekday(diary.createdAt) }}</span>
              </div>
              <div class="timeline-card">
                <h3 class="card-title">{{ diary.title }}</h3>
                <p class="card-preview">
                  {{ diary.body?.substring(0, 100) }}{{ diary.body?.length > 100 ? '...' : '' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.writing-diary {
  max-width: 680px;
  margin: 0 auto;
  padding: 20px;
}

.diary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 36px;
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

.diary-title {
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

/* Timeline */
.timeline {
  padding-left: 20px;
}

.timeline-group {
  margin-bottom: 20px;
}

.timeline-month {
  font-size: 15px;
  font-weight: 600;
  color: #5f6368;
  margin-bottom: 12px;
  padding-left: 28px;
}

.timeline-items {
  display: flex;
  flex-direction: column;
}

.timeline-item {
  display: flex;
  gap: 0;
  cursor: pointer;
  position: relative;
}

.timeline-dot-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 28px;
  flex-shrink: 0;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #1a73e8;
  border: 2px solid #e8f0fe;
  margin-top: 8px;
  flex-shrink: 0;
}

.timeline-line {
  width: 2px;
  flex: 1;
  background: #e8eaed;
  margin-top: 4px;
}

.timeline-item:last-child .timeline-line {
  background: transparent;
}

.timeline-content {
  flex: 1;
  padding-bottom: 20px;
  padding-left: 12px;
}

.timeline-date {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}

.date-day {
  font-size: 16px;
  font-weight: 600;
  color: #202124;
}

.date-weekday {
  font-size: 12px;
  color: #999;
}

.timeline-card {
  background: #ffffff;
  padding: 16px 20px;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.2s;
}

.timeline-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.timeline-card .card-title {
  font-size: 15px;
  font-weight: 600;
  color: #202124;
  margin: 0 0 6px 0;
}

.timeline-card .card-preview {
  font-size: 13px;
  color: #5f6368;
  line-height: 1.6;
  margin: 0;
}
</style>
