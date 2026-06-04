<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import type { GenericComment } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const novelId = computed(() => Number(route.params.id))

const novel = ref<any>(null)
const chapters = ref<any[]>([])
const currentChapterIndex = ref(0)
const isLoading = ref(true)

const showUI = ref(false)
const showLeftSidebar = ref(false)
const showRightSidebar = ref(false)
const pinnedRightSidebar = ref(false)
const lockUI = ref(false)
const commentMode = ref<'chapter' | 'book' | null>(null)

const colorTheme = ref<'light' | 'dark' | 'sepia'>(localStorage.getItem('reader_theme') as any || 'light')
const fontSize = ref(Number(localStorage.getItem('reader_fontSize') || '16'))
const showBookReviewSidebar = ref(false)
const isFavorited = ref(false)
const comments = ref<GenericComment[]>([])
const bookComments = ref<GenericComment[]>([])
const newComment = ref('')
const newBookComment = ref('')
const isLoadingComments = ref(false)
const isLoadingBookComments = ref(false)

const leftSidebarTab = ref<'toc' | 'settings'>('toc')

interface TocItem { chapterIndex: number; label: string; section: string }
const toc = computed(() => {
  const groups: { section: string; label: string; items: TocItem[] }[] = []
  for (let i = 0; i < chapters.value.length; i++) {
    const ch = chapters.value[i]
    const sec = ch.section || 'main'
    let group = groups.find(g => g.section === sec)
    if (!group) {
      group = { section: sec, label: sectionLabel[sec] || sec, items: [] }
      groups.push(group)
    }
    group.items.push({ chapterIndex: i, label: chapterPositionForIdx(i), section: sec })
  }
  return groups
})

interface Bookmark { id: string; chapterIndex: number; chapterTitle: string; scrollPercent: number; createdAt: string }
const bookmarks = ref<Bookmark[]>([])
const showBookmarkPanel = ref(false)

const currentChapter = computed(() => chapters.value[currentChapterIndex.value] || null)
const hasPrevChapter = computed(() => currentChapterIndex.value > 0)
const hasNextChapter = computed(() => currentChapterIndex.value < chapters.value.length - 1)

// Total content length for progress calculation
const totalCharCount = computed(() => {
  let total = 0
  for (const ch of chapters.value) total += (ch.body || '').length
  return total
})

// Current reading position (sum of previous chapters + scroll offset in current)
const currentReadingPos = ref(0)

function updateReadingPosition() {
  let pos = 0
  for (let i = 0; i < currentChapterIndex.value; i++) {
    pos += (chapters.value[i]?.body || '').length
  }
  // Estimate current scroll within visible content
  const el = document.querySelector('.nr-content')
  if (el) {
    const totalH = el.scrollHeight - el.clientHeight
    const scrolled = el.scrollTop
    const visibleRatio = totalH > 0 ? scrolled / totalH : 0
    const currentChapterLen = (currentChapter.value?.body || '').length
    pos += Math.round(visibleRatio * currentChapterLen)
  }
  currentReadingPos.value = pos
}

const progressPercent = computed(() => {
  if (totalCharCount.value <= 0) return 0
  return Math.min(100, Math.round((currentReadingPos.value / totalCharCount.value) * 100))
})

const sectionLabel: Record<string, string> = { main: '正文', preface: '前言', extra: '番外', postscript: '后记' }

const chapterPosition = computed(() => {
  const ch = currentChapter.value
  if (!ch) return ''
  return chapterPositionForIdx(currentChapterIndex.value)
})

function chapterPositionForIdx(idx: number): string {
  const ch = chapters.value[idx]
  if (!ch) return ''
  const sec = sectionLabel[ch.section] || ch.section
  let pos = sec
  if (novel.value?.hasVolumes && ch.volumeNumber > 0) pos += ` 第${toChineseNum(ch.volumeNumber)}卷`
  pos += ` 第${toChineseNum(ch.chapterNumber)}章`
  if (ch.title) pos += ` · ${ch.title}`
  return pos
}

function toChineseNum(n: number): string {
  const d = ['零','一','二','三','四','五','六','七','八','九']
  const dd = (i: number) => d[i] ?? ''
  if (n <= 0) return '零'
  if (n < 10) return dd(n)
  if (n < 20) return '十' + (n % 10 ? dd(n%10) : '')
  if (n < 100) { const t = Math.floor(n/10), o = n%10; return dd(t) + '十' + (o ? dd(o) : '') }
  const h = Math.floor(n/100), r = n%100
  let s = dd(h) + '百'
  if (!r) return s
  if (r < 10) return s + '零' + dd(r)
  if (r < 20) return s + '一十' + (r%10 ? dd(r%10) : '')
  const t = Math.floor(r/10), o = r%10
  return s + dd(t) + '十' + (o ? dd(o) : '')
}

async function loadNovel() {
  isLoading.value = true
  try {
    const res = await http.get(`/novels/${novelId.value}`)
    const data = res.data as any
    novel.value = data
    chapters.value = data.chapters || []
    if (chapters.value.length > 0) currentChapterIndex.value = 0
    loadBookmarks()
    recordNovelHistory()
    checkFavoriteStatus()
  } catch { novel.value = null }
  finally { isLoading.value = false }
}

async function checkFavoriteStatus() {
  if (!userStore.isLogin() || !novelId.value) return
  try {
    const res = await http.get(`/novels/${novelId.value}/favorite/status`)
    isFavorited.value = res.data?.favorited ?? (res.data as any) ?? false
  } catch { /* */ }
}

async function toggleFavorite() {
  if (!userStore.isLogin()) { alert('请先登录'); return }
  try {
    await http.post(`/novels/${novelId.value}/favorite`)
    isFavorited.value = !isFavorited.value
  } catch (e: any) { alert(e.message || '操作失败') }
}

function recordNovelHistory() {
  if (!novel.value || !userStore.userInfo?.id) return
  // Don't record own novels
  if (novel.value.userId === userStore.userInfo.id) return
  // Only record published novels
  if (!novel.value.isPublished) return
  try {
    const key = `browseHistory_${userStore.userInfo.id}`
    const stored = localStorage.getItem(key)
    const history = stored ? JSON.parse(stored) : []
    const filtered = history.filter((h: any) => !(h.entityType === 'NOVEL' && h.entityId === novel.value.id))
    filtered.unshift({
      entityId: novel.value.id,
      entityTitle: novel.value.title,
      entityType: 'NOVEL',
      authorName: novel.value.authorName,
      authorId: novel.value.userId,
      viewedAt: new Date().toISOString(),
    })
    localStorage.setItem(key, JSON.stringify(filtered.slice(0, 50)))
  } catch { /* */ }
}

function goToChapter(index: number) {
  if (index < 0 || index >= chapters.value.length) return
  currentChapterIndex.value = index
  nextTick(() => {
    // Scroll to the target chapter within concatenated content
    const el = document.querySelector('.nr-content')
    const chapterEl = el?.querySelector(`[data-chapter-index="${index}"]`)
    if (chapterEl && el) {
      el.scrollTo({ top: (chapterEl as HTMLElement).offsetTop - 20, behavior: 'smooth' })
    }
  })
}
function goToPrevChapter() { if (hasPrevChapter.value) goToChapter(currentChapterIndex.value - 1) }
function goToNextChapter() { if (hasNextChapter.value) goToChapter(currentChapterIndex.value + 1) }

function toggleUI() {
  if (lockUI.value) return
  const ns = !showUI.value
  showUI.value = ns
  showLeftSidebar.value = ns
  if (ns) {
    showRightSidebar.value = true
    loadChapterComments()
  } else {
    if (!pinnedRightSidebar.value) {
      showRightSidebar.value = false
    }
  }
}

function toggleBookComments() {
  showBookReviewSidebar.value = !showBookReviewSidebar.value
  if (showBookReviewSidebar.value) {
    loadBookComments()
  }
}

async function loadComments(sourceType: string, sourceId: number, target: 'chapter' | 'book') {
  if (target === 'chapter') isLoadingComments.value = true
  else isLoadingBookComments.value = true
  try {
    const res = await http.get<GenericComment[]>('/comments', { params: { sourceType, sourceId } })
    const list = res.data || []
    const map: Record<number, any> = {}; const roots: any[] = []
    list.forEach((c: any) => { map[c.id] = { ...c, children: [] } })
    list.forEach((c: any) => { if (c.parentId && map[c.parentId]) map[c.parentId].children.push(map[c.id]); else roots.push(map[c.id]) })
    if (target === 'chapter') comments.value = roots
    else bookComments.value = roots
  } catch { /* */ }
  finally {
    if (target === 'chapter') isLoadingComments.value = false
    else isLoadingBookComments.value = false
  }
}

async function loadChapterComments() {
  const sid = currentChapter.value?.id
  if (!sid) return
  await loadComments('NOVEL_CHAPTER', sid, 'chapter')
}

async function loadBookComments() {
  if (!novelId.value) return
  await loadComments('NOVEL', novelId.value, 'book')
}

async function submitComment(target: 'chapter' | 'book') {
  const body = target === 'chapter' ? newComment.value.trim() : newBookComment.value.trim()
  if (!body || !userStore.isLogin()) return
  const st = target === 'book' ? 'NOVEL' : 'NOVEL_CHAPTER'
  const sid = target === 'book' ? novelId.value : currentChapter.value?.id
  if (!sid) return
  try {
    await http.post('/comments', { body, parentId: null }, { params: { sourceType: st, sourceId: sid } } as any)
    if (target === 'chapter') newComment.value = ''
    else newBookComment.value = ''
    await (target === 'chapter' ? loadChapterComments() : loadBookComments())
  } catch { /* */ }
}

function loadBookmarks() {
  try { const r = localStorage.getItem(`novel_reader_bm_${novelId.value}`); bookmarks.value = r ? JSON.parse(r) : [] } catch { bookmarks.value = [] }
}
function saveBookmarks() { localStorage.setItem(`novel_reader_bm_${novelId.value}`, JSON.stringify(bookmarks.value)) }
function addBookmark() {
  const ch = currentChapter.value; if (!ch) return
  bookmarks.value.push({ id: Date.now().toString(), chapterIndex: currentChapterIndex.value, chapterTitle: ch.title || chapterPosition.value, scrollPercent: progressPercent.value, createdAt: new Date().toISOString() })
  saveBookmarks()
}
function removeBookmark(id: string) { bookmarks.value = bookmarks.value.filter(b => b.id !== id); saveBookmarks() }
function goToBookmark(bm: Bookmark) { goToChapter(bm.chapterIndex); showLeftSidebar.value = false; showBookmarkPanel.value = false }

function onScroll() {
  // Determine which chapter is currently in view
  const el = document.querySelector('.nr-content')
  if (!el) return
  const scrollTop = el.scrollTop
  let cumulative = 0
  let foundIdx = 0
  for (let i = 0; i < chapters.value.length; i++) {
    cumulative += (chapters.value[i]?.body || '').length
    // Rough heuristic: each char ≈ some pixels
    const estHeight = cumulative * 0.3  // ~0.3px per char
    if (scrollTop < estHeight) {
      foundIdx = i
      break
    }
    foundIdx = i
  }
  if (foundIdx !== currentChapterIndex.value) {
    currentChapterIndex.value = foundIdx
  }
  updateReadingPosition()
}

// Progress bar drag
function onProgressClick(e: MouseEvent) {
  const track = e.currentTarget as HTMLElement
  const rect = track.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  seekToRatio(ratio)
}

let progressDragActive = false
function onProgressMouseDown(e: MouseEvent) {
  progressDragActive = true
  document.addEventListener('mousemove', onProgressDragMove)
  document.addEventListener('mouseup', onProgressDragUp)
  onProgressClick(e)
}

function onProgressDragMove(e: MouseEvent) {
  if (!progressDragActive) return
  const track = document.querySelector('.nr-prog-track') as HTMLElement
  if (!track) return
  const rect = track.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  seekToRatio(ratio)
}

function onProgressDragUp() {
  progressDragActive = false
  document.removeEventListener('mousemove', onProgressDragMove)
  document.removeEventListener('mouseup', onProgressDragUp)
}

function seekToRatio(ratio: number) {
  if (totalCharCount.value <= 0) return
  const targetPos = Math.round(ratio * totalCharCount.value)
  let cumulative = 0
  let targetChapterIdx = 0
  for (let i = 0; i < chapters.value.length; i++) {
    const len = (chapters.value[i]?.body || '').length
    if (cumulative + len >= targetPos) {
      targetChapterIdx = i
      break
    }
    cumulative += len
    targetChapterIdx = i
  }
  currentChapterIndex.value = targetChapterIdx
  nextTick(() => {
    const el = document.querySelector('.nr-content')
    if (el) {
      const prevChaptersLen = cumulative
      const currentChapterLen = (chapters.value[targetChapterIdx]?.body || '').length || 1
      const internalRatio = (targetPos - prevChaptersLen) / currentChapterLen
      // Scroll to the right position within the concatenated content
      const targetScroll = el.scrollHeight * internalRatio * 0.75 + cumulative * 0.3
      el.scrollTop = Math.max(0, targetScroll)
      updateReadingPosition()
    }
  })
}
function onKeydown(e: KeyboardEvent) { if (e.key === 'ArrowLeft') goToPrevChapter(); if (e.key === 'ArrowRight') goToNextChapter() }

watch(currentChapterIndex, () => { if (showRightSidebar.value) loadChapterComments() })
watch(colorTheme, (v) => localStorage.setItem('reader_theme', v))
watch(fontSize, (v) => localStorage.setItem('reader_fontSize', String(v)))

onMounted(() => { loadNovel(); window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('keydown', onKeydown) })
onUnmounted(() => { window.removeEventListener('scroll', onScroll); window.removeEventListener('keydown', onKeydown) })
</script>

<template>
  <div class="nr-root" :class="[`theme-${colorTheme}`, `fs-${fontSize}`]">
    <div v-if="isLoading" class="nr-loading">加载中...</div>
    <div v-else-if="!novel" class="nr-error">小说不存在或未发布</div>

    <template v-else>
      <!-- Lock Button -->
      <button
        class="nr-lock-btn"
        :class="{ locked: lockUI }"
        @click.stop="lockUI = !lockUI"
        :title="lockUI ? '解锁界面' : '锁定界面'"
      >{{ lockUI ? '🔒' : '🔓' }}</button>

      <!-- Top Bar -->
      <Transition name="bar-fade">
        <div v-if="showUI" class="nr-topbar">
          <button class="nr-btn-back" @click="router.push('/wild/library')">← 返回</button>
          <div class="nr-book-info">
            <span class="nr-book-title">{{ novel.title }}</span>
            <span v-if="currentChapter" class="nr-chapter-pos">{{ chapterPosition }}</span>
          </div>
          <span class="nr-author" @click="router.push(`/profile/${novel.userId}`)">👤 {{ novel.authorName || '匿名' }}</span>
          <button class="nr-fav-btn" :class="{ favorited: isFavorited }" @click.stop="toggleFavorite" :title="isFavorited ? '取消收藏' : '收藏'">
            {{ isFavorited ? '⭐' : '☆' }}
          </button>
        </div>
      </Transition>

      <!-- Main flex row: left sidebar + content + right sidebar -->
      <div class="nr-main" :class="{ 'has-top': showUI, 'has-bottom': showUI }">
        <!-- Left Sidebar -->
        <div class="nr-left" :class="{ open: showLeftSidebar }">
          <div class="nr-left-inner">
            <!-- Tab buttons -->
            <div class="nr-left-tabs">
              <button :class="['nr-left-tab', { active: leftSidebarTab === 'toc' }]" @click="leftSidebarTab = 'toc'">目录</button>
              <button :class="['nr-left-tab', { active: leftSidebarTab === 'settings' }]" @click="leftSidebarTab = 'settings'">设置</button>
            </div>

            <!-- TOC tab -->
            <div v-if="leftSidebarTab === 'toc'" class="nr-toc">
              <div v-for="g in toc" :key="g.section" class="nr-toc-section">
                <div class="nr-toc-section-hdr">
                  <span class="nr-toc-section-label">{{ g.label }}</span>
                  <span class="nr-toc-section-count">{{ g.items.length }}</span>
                </div>
                <div class="nr-toc-chs">
                  <div
                    v-for="item in g.items"
                    :key="item.chapterIndex"
                    :class="['nr-toc-ch', { active: currentChapterIndex === item.chapterIndex }]"
                    @click="goToChapter(item.chapterIndex)"
                  >
                    <span class="nr-toc-ch-label">{{ item.label }}</span>
                  </div>
                </div>
              </div>
              <div v-if="toc.length === 0" class="nr-toc-empty">暂无章节</div>
            </div>

            <!-- Settings tab -->
            <div v-else class="nr-settings">
              <div class="nr-set-group">
                <label>主题</label>
                <div class="nr-theme-btns">
                  <button :class="{ active: colorTheme === 'light' }" @click="colorTheme = 'light'">浅色</button>
                  <button :class="{ active: colorTheme === 'dark' }" @click="colorTheme = 'dark'">深色</button>
                  <button :class="{ active: colorTheme === 'sepia' }" @click="colorTheme = 'sepia'">护眼</button>
                </div>
              </div>
              <div class="nr-set-group">
                <label>字体: {{ fontSize }}px</label>
                <div class="nr-font-btns">
                  <button @click="fontSize = Math.max(12, fontSize - 2)">−</button>
                  <button @click="fontSize = Math.min(24, fontSize + 2)">+</button>
                </div>
              </div>
              <div class="nr-set-group">
                <button class="nr-bm-btn" @click="addBookmark">🔖 记录书签</button>
              </div>
              <div class="nr-set-group">
                <button class="nr-bm-btn" @click="showBookmarkPanel = !showBookmarkPanel">📑 书签 ({{ bookmarks.length }})</button>
                <div v-if="showBookmarkPanel" class="nr-bm-panel">
                  <div v-if="bookmarks.length === 0" class="nr-bm-empty">暂无书签</div>
                  <div v-for="bm in bookmarks" :key="bm.id" class="nr-bm-item">
                    <div class="bm-info" @click="goToBookmark(bm)">
                      <span class="bm-title">{{ bm.chapterTitle }}</span>
                      <span class="bm-time">{{ new Date(bm.createdAt).toLocaleString('zh-CN') }}</span>
                    </div>
                    <button class="bm-del" @click="removeBookmark(bm.id)">×</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Content -->
        <div class="nr-content" @click="toggleUI" ref="contentEl">
          <template v-for="(ch, ci) in chapters" :key="ci">
            <div class="nr-chapter" :data-chapter-index="ci">
              <h2 class="nr-chapter-title">{{ chapterPositionForIdx(ci) }}</h2>
              <div class="nr-chapter-body">
                <p v-for="(line, i) in (ch.body || '').split('\n')" :key="i">{{ line }}</p>
              </div>
            </div>
            <div v-if="ci < chapters.length - 1" class="nr-chapter-sep">* * *</div>
          </template>
          <div class="nr-chapter-end">
            <p class="nr-end-hint">— 全书完 —</p>
          </div>
        </div>

        <!-- Book Review Sidebar (closer to content) -->
        <div class="nr-right nr-right-book" :class="{ open: showBookReviewSidebar }">
          <div class="nr-right-inner">
            <div class="nr-comm-head">
              <h3>本书评论</h3>
              <button class="nr-close-btn" @click="showBookReviewSidebar = false">✕</button>
            </div>
            <div v-if="userStore.isLogin()" class="nr-comm-form">
              <textarea v-model="newBookComment" placeholder="发表书评..." rows="3"></textarea>
              <button :disabled="!newBookComment.trim()" @click="submitComment('book')">发表</button>
            </div>
            <div v-if="isLoadingBookComments" class="nr-comm-hint">加载中...</div>
            <div v-else-if="bookComments.length === 0" class="nr-comm-hint">暂无评论</div>
            <div v-else class="nr-comm-list">
              <div v-for="c in bookComments" :key="c.id" class="nr-comm-item">
                <div class="nr-comm-meta">
                  <span class="nr-comm-author" @click="router.push(`/profile/${c.userId}`)">{{ c.authorName }}</span>
                  <span class="nr-comm-time">{{ new Date(c.createdAt).toLocaleDateString('zh-CN') }}</span>
                </div>
                <p class="nr-comm-body">{{ c.body }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Chapter Review Sidebar (rightmost) -->
        <div class="nr-right nr-right-chapter" :class="{ open: showRightSidebar }">
          <div class="nr-right-inner">
            <div class="nr-comm-head">
              <h3>本章评论</h3>
              <div class="nr-comm-head-actions">
                <button
                  :class="['nr-pin-btn', { pinned: pinnedRightSidebar }]"
                  @click="pinnedRightSidebar = !pinnedRightSidebar"
                  title="固定评论面板"
                >📌</button>
                <button class="nr-close-btn" @click="showRightSidebar = false; pinnedRightSidebar = false">✕</button>
              </div>
            </div>
            <div v-if="userStore.isLogin()" class="nr-comm-form">
              <textarea v-model="newComment" placeholder="发表评论..." rows="3"></textarea>
              <button :disabled="!newComment.trim()" @click="submitComment('chapter')">发表</button>
            </div>
            <div v-if="isLoadingComments" class="nr-comm-hint">加载中...</div>
            <div v-else-if="comments.length === 0" class="nr-comm-hint">暂无评论</div>
            <div v-else class="nr-comm-list">
              <div v-for="c in comments" :key="c.id" class="nr-comm-item">
                <div class="nr-comm-meta">
                  <span class="nr-comm-author" @click="router.push(`/profile/${c.userId}`)">{{ c.authorName }}</span>
                  <span class="nr-comm-time">{{ new Date(c.createdAt).toLocaleDateString('zh-CN') }}</span>
                </div>
                <p class="nr-comm-body">{{ c.body }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Bar -->
      <Transition name="bar-fade">
        <div v-if="showUI" class="nr-bottombar">
          <button class="nr-nav-btn" :disabled="!hasPrevChapter" @click.stop="goToPrevChapter">← 上一章</button>
          <div class="nr-prog-wrap" @click.stop>
            <div class="nr-prog-track" @click="onProgressClick" @mousedown.prevent="onProgressMouseDown">
              <div class="nr-prog-fill" :style="{ width: progressPercent + '%' }"></div>
              <div class="nr-prog-thumb" :style="{ left: progressPercent + '%' }"></div>
            </div>
            <span class="nr-prog-text">{{ progressPercent }}%</span>
          </div>
          <button class="nr-nav-btn" @click.stop="toggleBookComments">💬 书评</button>
          <button class="nr-nav-btn" :disabled="!hasNextChapter" @click.stop="goToNextChapter">下一章 →</button>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
/* ===== Root ===== */
.nr-root {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  transition: background 0.3s;
}
.nr-loading, .nr-error {
  display: flex; align-items: center; justify-content: center; height: 100%; color: #999; font-size: 16px;
}

/* ===== Main flex row ===== */
.nr-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  padding-top: 0;
  padding-bottom: 0;
  transition: padding 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.nr-main.has-top { padding-top: 48px; }
.nr-main.has-bottom { padding-bottom: 44px; }

/* ===== Left Sidebar ===== */
.nr-left {
  width: 0;
  overflow: hidden;
  background: #fff;
  border-right: 1px solid #e8eaed;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}
.nr-left.open { width: 260px; }
.nr-left-inner {
  width: 260px;
  padding: 20px 16px;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}
.nr-left-inner h3 { margin: 0 0 16px 0; font-size: 15px; color: #202124; }

/* Left sidebar tabs */
.nr-left-tabs {
  display: flex; gap: 0; margin-bottom: 14px;
  border-bottom: 1px solid #e8eaed; padding-bottom: 0;
}
.nr-left-tab {
  flex: 1; padding: 8px 0; background: none; border: none;
  border-bottom: 2px solid transparent; font-size: 13px; color: #5f6368;
  cursor: pointer; font-family: inherit; transition: all 0.15s;
}
.nr-left-tab.active { color: #d97706; border-bottom-color: #d97706; font-weight: 600; }

/* TOC */
.nr-toc { flex: 1; overflow-y: auto; }
.nr-toc-section { margin-bottom: 8px; }
.nr-toc-section-hdr {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 4px; font-size: 13px; font-weight: 600; color: #5f6368;
}
.nr-toc-section-count { font-size: 11px; color: #999; }
.nr-toc-chs { padding-left: 10px; }
.nr-toc-ch {
  display: flex; align-items: center; padding: 6px 8px; border-radius: 5px;
  cursor: pointer; font-size: 12px; color: #202124; transition: all 0.1s;
  border-left: 2px solid transparent;
}
.nr-toc-ch:hover { background: #f1f3f4; }
.nr-toc-ch.active { background: #fef3c7; border-left-color: #d97706; font-weight: 500; }
.nr-toc-ch-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nr-toc-empty { font-size: 12px; color: #999; padding: 20px 0; text-align: center; }

.nr-settings { }
.nr-settings .nr-set-group:first-child { margin-top: 0; }

.nr-set-group { margin-bottom: 16px; }
.nr-set-group label { display: block; font-size: 12px; color: #5f6368; margin-bottom: 6px; }
.nr-theme-btns, .nr-font-btns { display: flex; gap: 6px; }
.nr-theme-btns button, .nr-font-btns button {
  padding: 5px 10px; background: #f8f9fa; border: 1px solid #dadce0; border-radius: 5px; cursor: pointer; font-size: 12px;
}
.nr-theme-btns button.active { background: #1a73e8; color: #fff; border-color: #1a73e8; }
.nr-bm-btn {
  width: 100%; padding: 8px; background: #f8f9fa; border: 1px solid #dadce0; border-radius: 6px; cursor: pointer; font-size: 13px; text-align: left;
}
.nr-bm-panel { margin-top: 6px; border-top: 1px solid #f1f3f4; padding-top: 6px; }
.nr-bm-empty { font-size: 12px; color: #999; padding: 10px 0; text-align: center; }
.nr-bm-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f8f9fa; }
.bm-info { cursor: pointer; flex: 1; min-width: 0; }
.bm-title { font-size: 13px; color: #202124; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bm-time { font-size: 11px; color: #999; }
.bm-del { background: none; border: none; color: #d93025; cursor: pointer; font-size: 14px; padding: 2px 4px; flex-shrink: 0; }

/* ===== Content Area ===== */
.nr-content {
  flex: 1;
  overflow-y: auto;
  padding: 40px max(5%, 24px) 80px;
  cursor: pointer;
  -webkit-overflow-scrolling: touch;
  min-width: 0;
}
.nr-chapter { max-width: 720px; margin: 0 auto; }
.nr-chapter-title { font-size: 22px; font-weight: 700; color: #202124; margin: 0 0 24px 0; text-align: center; }
.nr-chapter-body { font-size: inherit; line-height: 1.8; color: #333; }
.nr-chapter-body p { margin: 0 0 16px 0; text-indent: 2em; }
.nr-chapter-sep { text-align: center; margin: 32px 0; font-size: 18px; color: #ccc; letter-spacing: 8px; user-select: none; }
.nr-chapter-end { text-align: center; margin: 40px 0 20px; padding: 20px 0; }
.nr-continue-hint { color: #999; font-size: 14px; margin: 0; }
.nr-end-hint { color: #bbb; font-size: 14px; margin: 0; }

/* ===== Right Sidebar ===== */
.nr-right {
  width: 0;
  overflow: hidden;
  background: #fff;
  border-left: 1px solid #e8eaed;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}
.nr-right.open { width: 280px; }
.nr-right-inner {
  width: 280px;
  padding: 20px 16px;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}
.nr-comm-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-shrink: 0; }
.nr-comm-head h3 { margin: 0; font-size: 15px; color: #202124; }
.nr-comm-head-actions { display: flex; gap: 6px; align-items: center; }
.nr-pin-btn { background: none; border: 1px solid #dadce0; border-radius: 4px; cursor: pointer; font-size: 14px; padding: 2px 6px; line-height: 1; }
.nr-pin-btn.pinned { background: #1a73e8; border-color: #1a73e8; }
.nr-close-btn { background: none; border: none; font-size: 16px; cursor: pointer; color: #999; }

.nr-comm-form { margin-bottom: 14px; flex-shrink: 0; }
.nr-comm-form textarea { width: 100%; border: 1px solid #dadce0; border-radius: 6px; padding: 8px; font-size: 13px; resize: vertical; box-sizing: border-box; }
.nr-comm-form button { margin-top: 6px; padding: 5px 14px; background: #1a73e8; color: #fff; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; float: right; }
.nr-comm-form button:disabled { opacity: 0.5; cursor: not-allowed; }
.nr-comm-hint { text-align: center; color: #999; padding: 16px 0; font-size: 13px; }
.nr-comm-list { flex: 1; overflow-y: auto; }
.nr-comm-item { padding: 10px 0; border-bottom: 1px solid #f8f9fa; }
.nr-comm-meta { display: flex; gap: 8px; margin-bottom: 3px; }
.nr-comm-author { font-weight: 600; color: #1a73e8; cursor: pointer; font-size: 12px; }
.nr-comm-time { font-size: 11px; color: #999; }
.nr-comm-body { font-size: 13px; color: #333; line-height: 1.5; margin: 0; }

/* ===== Theme: Dark ===== */
.theme-dark { background: #1a1a2e; }
.theme-dark .nr-content { background: #1a1a2e; }
.theme-dark .nr-chapter-title { color: #e0e0e0; }
.theme-dark .nr-chapter-body { color: #ccc; }
.theme-dark .nr-left, .theme-dark .nr-right { background: #22263a; border-color: #333; }
.theme-dark .nr-left-inner h3, .theme-dark .nr-comm-head h3 { color: #e0e0e0; }
.theme-dark .nr-continue-hint { color: #555; }

/* ===== Theme: Sepia ===== */
.theme-sepia { background: #f4ecd8; }
.theme-sepia .nr-content { background: #f4ecd8; }
.theme-sepia .nr-chapter-body { color: #5b4636; }
.theme-sepia .nr-left, .theme-sepia .nr-right { background: #f0e5cf; border-color: #d6c8a8; }

/* ===== Top Bar ===== */
.nr-topbar {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 2100;
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px;
  background: rgba(255,255,255,0.95); backdrop-filter: blur(12px);
  border-bottom: 1px solid #e8eaed;
}
.theme-dark .nr-topbar { background: rgba(26,26,46,0.95); border-color: #333; }
.theme-sepia .nr-topbar { background: rgba(244,236,216,0.95); border-color: #d6c8a8; }
.nr-btn-back { background: none; border: none; color: #1a73e8; cursor: pointer; font-size: 14px; padding: 4px 8px; }
.nr-book-info { text-align: center; }
.nr-book-title { font-size: 15px; font-weight: 600; }
.nr-chapter-pos { display: block; font-size: 12px; color: #5f6368; margin-top: 2px; }
.nr-author { font-size: 13px; color: #1a73e8; cursor: pointer; font-weight: 500; }
.nr-author:hover { text-decoration: underline; }
.nr-fav-btn { background: none; border: none; font-size: 18px; cursor: pointer; padding: 0 4px; color: #999; transition: color 0.15s; }
.nr-fav-btn:hover { color: #f59e0b; }
.nr-fav-btn.favorited { color: #f59e0b; }

/* ===== Bottom Bar ===== */
.nr-bottombar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  z-index: 2100;
  display: flex; align-items: center; gap: 10px;
  padding: 8px 20px;
  background: rgba(255,255,255,0.95); backdrop-filter: blur(12px);
  border-top: 1px solid #e8eaed;
}
.theme-dark .nr-bottombar { background: rgba(26,26,46,0.95); border-color: #333; }
.theme-sepia .nr-bottombar { background: rgba(244,236,216,0.95); border-color: #d6c8a8; }
.nr-nav-btn {
  padding: 5px 12px; background: #f8f9fa; border: 1px solid #dadce0; border-radius: 5px; cursor: pointer; font-size: 13px; color: #1a73e8; white-space: nowrap;
}
.nr-nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.nr-nav-btn:hover:not(:disabled) { background: #e8f0fe; }

.nr-prog-wrap { flex: 1; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.nr-prog-track { flex: 1; height: 4px; background: #e0e0e0; border-radius: 2px; position: relative; }
.nr-prog-fill { height: 100%; background: #1a73e8; border-radius: 2px; transition: width 0.1s; }
.nr-prog-thumb { position: absolute; top: 50%; transform: translate(-50%,-50%); width: 12px; height: 12px; background: #fff; border: 2px solid #1a73e8; border-radius: 50%; }
.nr-prog-text { font-size: 11px; color: #999; min-width: 30px; text-align: right; }

/* ===== Lock Button ===== */
.nr-lock-btn {
  position: fixed; right: 8px; top: 50%; transform: translateY(-50%);
  z-index: 2200; background: transparent; border: none; font-size: 20px;
  cursor: pointer; opacity: 0.35; transition: opacity 0.2s; padding: 8px;
}
.nr-lock-btn:hover { opacity: 0.85; }
.nr-lock-btn.locked { opacity: 0.65; }

/* ===== Transitions ===== */
.bar-fade-enter-active, .bar-fade-leave-active { transition: opacity 0.25s ease; }
.bar-fade-enter-from, .bar-fade-leave-to { opacity: 0; }

/* ===== Font sizes ===== */
.fs-12 .nr-chapter-body { font-size: 12px; }
.fs-14 .nr-chapter-body { font-size: 14px; }
.fs-16 .nr-chapter-body { font-size: 16px; }
.fs-18 .nr-chapter-body { font-size: 18px; }
.fs-20 .nr-chapter-body { font-size: 20px; }
.fs-22 .nr-chapter-body { font-size: 22px; }
.fs-24 .nr-chapter-body { font-size: 24px; }
</style>
