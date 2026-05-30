<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import type { World, NovelCard } from '@/types'

const router = useRouter()
const userStore = useUserStore()

// ============ World (设定世界观) ============
const worlds = ref<World[]>([])
const isLoadingWorlds = ref(false)

// ============ Novel (小说) ============
const novels = ref<NovelCard[]>([])
const isLoadingNovels = ref(false)

// ============ Diary (日记) ============
const diaries = ref<any[]>([])
const diaryStreak = ref(0)
const isLoadingDiary = ref(false)

// ============ Essay (散文) ============
const essays = ref<any[]>([])
const isLoadingEssay = ref(false)

// ============ Inspiration (灵感) ============
const inspirations = ref<any[]>([])
const isLoadingInspiration = ref(false)
const newInspiration = ref('')
const isSubmittingInspiration = ref(false)

// ============ Helpers ============
const formatDate = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const truncateText = (text: string, max: number) => {
  if (!text) return ''
  return text.length > max ? text.substring(0, max) + '...' : text
}

// ============ Load all data ============
async function loadAll() {
  // Load worlds
  isLoadingWorlds.value = true
  http.get('/worlds').then(res => {
    const list = (res.data || []) as World[]
    list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    worlds.value = list
  }).catch(() => {}).finally(() => { isLoadingWorlds.value = false })

  // Load novels
  isLoadingNovels.value = true
  http.get('/novels').then(res => {
    const list = (res.data || []) as any[]
    list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    novels.value = list as NovelCard[]
  }).catch(() => {}).finally(() => { isLoadingNovels.value = false })

  // Load diaries + streak
  isLoadingDiary.value = true
  Promise.all([
    http.get('/articles', { params: { type: 'DIARY' } }),
    http.get('/articles/diary-streak'),
  ]).then(([articleRes, streakRes]) => {
    const list = (articleRes.data || []) as any[]
    list.sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    diaries.value = list
    diaryStreak.value = (streakRes.data as number) ?? 0
  }).catch(() => {}).finally(() => { isLoadingDiary.value = false })

  // Load essays
  isLoadingEssay.value = true
  http.get('/articles', { params: { type: 'ESSAY' } }).then(res => {
    const list = (res.data || []) as any[]
    list.sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    essays.value = list
  }).catch(() => {}).finally(() => { isLoadingEssay.value = false })

  // Load inspirations
  isLoadingInspiration.value = true
  http.get('/inspirations').then(res => {
    const list = (res.data || []) as any[]
    list.sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    inspirations.value = list
  }).catch(() => {}).finally(() => { isLoadingInspiration.value = false })
}

// ============ Actions ============
function goToWorld(id: number) { router.push(`/create/setting/${id}`) }
function goToAddWorld() { router.push('/create/setting') }
function goToNovel(novel: NovelCard) { router.push(`/writing/novel/${novel.id}`) }
function goToAddNovel() { router.push('/writing/novel/new') }
function goToDiary(id: number) { router.push(`/writing/diary/${id}`) }
function goToWriteDiary() { router.push('/writing/diary/new') }
function goToEssay(id: number) { router.push(`/writing/essay/${id}`) }
function goToWriteEssay() { router.push('/writing/essay/new') }
function goToInspiration() { router.push('/create/inspiration') }

async function submitInspiration() {
  const content = newInspiration.value.trim()
  if (!content) return
  isSubmittingInspiration.value = true
  try {
    const res = await http.post('/inspirations', { content })
    inspirations.value.unshift(res.data as any)
    newInspiration.value = ''
  } catch (e: any) {
    alert(e.message || '记录失败')
  } finally {
    isSubmittingInspiration.value = false
  }
}

onMounted(() => {
  if (userStore.isLogin()) loadAll()
})
</script>

<template>
  <div class="cc-layout">
    <!-- ============= LEFT 2/3 ============= -->
    <div class="cc-left">
      <!-- World Widget -->
      <section class="cc-widget world-widget">
        <div class="widget-header">
          <h3 class="widget-title">🌍 设定世界观</h3>
          <button class="widget-add-btn" @click="goToAddWorld">+ 添加新世界</button>
        </div>
        <div v-if="isLoadingWorlds" class="widget-loading">加载中...</div>
        <div v-else-if="worlds.length === 0" class="widget-empty">
          <span class="empty-icon">🌌</span>
          <span>还没有世界观，点击右上角创建第一个吧</span>
        </div>
        <div v-else class="widget-scroll-row">
          <div
            v-for="w in worlds"
            :key="w.id"
            class="world-card"
            @click="goToWorld(w.id)"
          >
            <div class="wc-name">{{ w.name }}</div>
            <div class="wc-meta">
              <span v-if="w.type" class="wc-type">{{ w.type }}</span>
              <span v-if="w.entryCount != null" class="wc-entries">{{ w.entryCount }} 条目</span>
            </div>
            <div class="wc-desc">{{ w.description || '暂无简介' }}</div>
            <div class="wc-date">{{ formatDate(w.updatedAt || w.createdAt) }}</div>
          </div>
        </div>
      </section>

      <!-- Novel Widget -->
      <section class="cc-widget novel-widget">
        <div class="widget-header">
          <h3 class="widget-title">📖 小说</h3>
          <button class="widget-add-btn" @click="goToAddNovel">+ 添加新小说</button>
        </div>
        <div v-if="isLoadingNovels" class="widget-loading">加载中...</div>
        <div v-else-if="novels.length === 0" class="widget-empty">
          <span class="empty-icon">📚</span>
          <span>还没有小说，点击右上角创建第一部吧</span>
        </div>
        <div v-else class="widget-scroll-row">
          <div
            v-for="n in novels"
            :key="n.id"
            class="novel-card"
            @click="goToNovel(n)"
          >
            <div class="nc-name">{{ n.title }}</div>
            <div class="nc-meta">
              <span v-if="n.chapterCount" class="nc-chapters">{{ n.chapterCount }} 章</span>
              <span v-if="n.totalWordCount" class="nc-words">{{ n.totalWordCount }} 字</span>
              <span v-if="n.worldName" class="nc-world">📖 {{ n.worldName }}</span>
            </div>
            <div class="nc-desc">{{ truncateText(n.description || '', 80) }}</div>
            <div class="nc-date">{{ formatDate(n.updatedAt || n.createdAt) }}</div>
          </div>
        </div>
      </section>
    </div>

    <!-- ============= RIGHT 1/3 ============= -->
    <div class="cc-right">
      <!-- Diary Widget -->
      <section class="cc-widget diary-widget">
        <h3 class="widget-title">📅 日记</h3>
        <div v-if="isLoadingDiary" class="widget-loading">加载中...</div>
        <div v-else class="diary-inner">
          <div class="diary-streak-col">
            <div class="streak-label">连续写作</div>
            <div class="streak-number">{{ diaryStreak }}</div>
            <div class="streak-unit">天</div>
            <button class="diary-write-btn" @click="goToWriteDiary">✍️ 写日记</button>
          </div>
          <div class="diary-list-col">
            <div v-if="diaries.length === 0" class="diary-empty">暂无日记</div>
            <div
              v-for="d in diaries"
              :key="d.id"
              class="diary-item"
              @click="goToDiary(d.id)"
            >
              <div class="diary-item-title">{{ d.title || '无标题' }}</div>
              <div class="diary-item-meta">
                <span>{{ formatDate(d.createdAt) }}</span>
                <span v-if="d.wordCount">{{ d.wordCount }} 字</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Essay Widget -->
      <section class="cc-widget essay-widget">
        <h3 class="widget-title">📝 散文</h3>
        <div v-if="isLoadingEssay" class="widget-loading">加载中...</div>
        <div v-else>
          <div v-if="essays.length === 0" class="widget-empty small">暂无散文</div>
          <div v-else class="essay-list">
            <div
              v-for="e in essays"
              :key="e.id"
              class="essay-item"
              @click="goToEssay(e.id)"
            >
              <div class="essay-item-preview">{{ truncateText(e.body || '', 60) }}</div>
              <div class="essay-item-meta">
                <span>{{ formatDate(e.createdAt) }}</span>
                <span v-if="e.wordCount">{{ e.wordCount }} 字</span>
              </div>
            </div>
          </div>
          <button class="essay-write-btn" @click="goToWriteEssay">✍️ 写散文</button>
        </div>
      </section>

      <!-- Inspiration Widget -->
      <section class="cc-widget inspiration-widget">
        <h3 class="widget-title">💡 灵感</h3>
        <div v-if="isLoadingInspiration" class="widget-loading">加载中...</div>
        <div v-else>
          <div v-if="inspirations.length === 0" class="widget-empty small">暂无灵感记录</div>
          <div v-else class="insp-list">
            <div
              v-for="ins in inspirations"
              :key="ins.id"
              class="insp-item"
              @click="goToInspiration"
            >
              <div class="insp-item-content">{{ truncateText(ins.content, 60) }}</div>
              <div class="insp-item-date">{{ formatDate(ins.updatedAt || ins.createdAt) }}</div>
            </div>
          </div>
          <div class="insp-input-row">
            <textarea
              v-model="newInspiration"
              class="insp-textarea"
              placeholder="捕捉此刻灵感..."
              rows="2"
              @keydown.ctrl.enter="submitInspiration"
            ></textarea>
            <button
              class="insp-submit-btn"
              :disabled="!newInspiration.trim() || isSubmittingInspiration"
              @click="submitInspiration"
            >
              {{ isSubmittingInspiration ? '...' : '记录' }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* ===== LAYOUT ===== */
.cc-layout {
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px 24px;
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
  align-items: start;
}

.cc-left {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

.cc-right {
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: sticky;
  top: 20px;
}

/* ===== WIDGET BASE ===== */
.cc-widget {
  background: #fff;
  border-radius: 14px;
  padding: 22px 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  border: 1px solid #f1f3f4;
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.widget-title {
  font-size: 17px;
  font-weight: 600;
  color: #202124;
  margin: 0;
}

.widget-add-btn {
  padding: 6px 14px;
  background: #e8f0fe;
  color: #1a73e8;
  border: 1px solid #d2e3fc;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  font-family: inherit;
}
.widget-add-btn:hover {
  background: #d2e3fc;
  border-color: #1a73e8;
}

.widget-loading {
  text-align: center;
  padding: 32px 0;
  color: #999;
  font-size: 14px;
}

.widget-empty {
  text-align: center;
  padding: 32px 16px;
  color: #999;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.widget-empty.small {
  padding: 16px 8px;
  font-size: 13px;
}
.empty-icon {
  font-size: 32px;
}

/* ===== HORIZONTAL SCROLL ROW (Worlds & Novels) ===== */
.widget-scroll-row {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  overflow-y: visible;
  padding: 6px 2px 10px 2px;
  margin: -6px -2px -10px -2px;
  scroll-behavior: smooth;
}
.widget-scroll-row::-webkit-scrollbar {
  height: 4px;
}
.widget-scroll-row::-webkit-scrollbar-thumb {
  background: #dadce0;
  border-radius: 2px;
}
.widget-scroll-row::-webkit-scrollbar-track {
  background: transparent;
}

/* ===== WORLD CARDS ===== */
.world-card {
  flex: 0 0 220px;
  background: linear-gradient(135deg, #e8f0fe 0%, #f0f6ff 100%);
  border: 1px solid #d2e3fc;
  border-radius: 12px;
  padding: 18px 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 160px;
}
.world-card:hover {
  border-color: #1a73e8;
  box-shadow: 0 4px 16px rgba(26,115,232,0.1);
  transform: translateY(-2px);
}

.wc-name {
  font-size: 16px;
  font-weight: 600;
  color: #202124;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wc-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.wc-type {
  font-size: 12px;
  padding: 2px 8px;
  background: rgba(26,115,232,0.1);
  color: #1a73e8;
  border-radius: 20px;
}
.wc-entries {
  font-size: 12px;
  color: #5f6368;
}

.wc-desc {
  font-size: 13px;
  color: #5f6368;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.wc-date {
  font-size: 12px;
  color: #999;
}

/* ===== NOVEL CARDS ===== */
.novel-card {
  flex: 0 0 220px;
  background: linear-gradient(135deg, #fef7e0 0%, #fff8e1 100%);
  border: 1px solid #fef0c8;
  border-radius: 12px;
  padding: 18px 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 160px;
}
.novel-card:hover {
  border-color: #e37400;
  box-shadow: 0 4px 16px rgba(227,116,0,0.1);
  transform: translateY(-2px);
}

.nc-name {
  font-size: 16px;
  font-weight: 600;
  color: #202124;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nc-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.nc-chapters {
  font-size: 12px;
  padding: 2px 8px;
  background: rgba(227,116,0,0.1);
  color: #e37400;
  border-radius: 20px;
}
.nc-words {
  font-size: 12px;
  color: #5f6368;
}
.nc-world {
  font-size: 12px;
  color: #1a73e8;
}

.nc-desc {
  font-size: 13px;
  color: #5f6368;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.nc-date {
  font-size: 12px;
  color: #999;
}

/* ===== DIARY WIDGET ===== */
.diary-inner {
  display: flex;
  gap: 20px;
  min-height: 180px;
}

.diary-streak-col {
  flex: 0 0 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.streak-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}
.streak-number {
  font-size: 48px;
  font-weight: 800;
  color: #1a73e8;
  line-height: 1;
}
.streak-unit {
  font-size: 14px;
  color: #5f6368;
  margin-bottom: 12px;
}

.diary-write-btn {
  padding: 6px 16px;
  background: #1a73e8;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  font-family: inherit;
}
.diary-write-btn:hover {
  background: #1557b0;
}

.diary-list-col {
  flex: 1;
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 4px;
}
.diary-list-col::-webkit-scrollbar {
  width: 4px;
}
.diary-list-col::-webkit-scrollbar-thumb {
  background: #dadce0;
  border-radius: 2px;
}

.diary-empty {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 16px 0;
}

.diary-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.diary-item:hover {
  background: #f1f3f4;
}

.diary-item-title {
  font-size: 13px;
  font-weight: 500;
  color: #202124;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 2px;
}
.diary-item-meta {
  font-size: 11px;
  color: #999;
  display: flex;
  gap: 8px;
}

/* ===== ESSAY WIDGET ===== */
.essay-list {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
}
.essay-list::-webkit-scrollbar {
  width: 4px;
}
.essay-list::-webkit-scrollbar-thumb {
  background: #dadce0;
  border-radius: 2px;
}

.essay-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.essay-item:hover {
  background: #f1f3f4;
}

.essay-item-preview {
  font-size: 13px;
  color: #333;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 2px;
}
.essay-item-meta {
  font-size: 11px;
  color: #999;
  display: flex;
  gap: 8px;
}

.essay-write-btn {
  width: 100%;
  padding: 8px 0;
  background: #fff;
  color: #137333;
  border: 1px solid #ceead6;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.essay-write-btn:hover {
  background: #e6f4ea;
}

/* ===== INSPIRATION WIDGET ===== */
.insp-list {
  max-height: 160px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
}
.insp-list::-webkit-scrollbar {
  width: 4px;
}
.insp-list::-webkit-scrollbar-thumb {
  background: #dadce0;
  border-radius: 2px;
}

.insp-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.insp-item:hover {
  background: #f1f3f4;
}

.insp-item-content {
  font-size: 13px;
  color: #333;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 2px;
}
.insp-item-date {
  font-size: 11px;
  color: #999;
}

.insp-input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.insp-textarea {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #dadce0;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: #202124;
  resize: none;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.insp-textarea:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26,115,232,0.1);
}

.insp-submit-btn {
  padding: 8px 16px;
  background: #1a73e8;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s;
  white-space: nowrap;
  font-family: inherit;
}
.insp-submit-btn:hover:not(:disabled) {
  background: #1557b0;
}
.insp-submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 900px) {
  .cc-layout {
    grid-template-columns: 1fr;
    padding: 16px;
  }
  .cc-right {
    position: static;
  }
  .diary-inner {
    flex-direction: column;
  }
  .diary-streak-col {
    flex-direction: row;
    gap: 12px;
    align-items: center;
    justify-content: center;
  }
  .streak-number {
    font-size: 32px;
  }
  .streak-unit {
    margin-bottom: 0;
  }
}
</style>
