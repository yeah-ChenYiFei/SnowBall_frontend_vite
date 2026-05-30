<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'

const router = useRouter()

interface ShardItem {
  id: number
  kind: 'ESSAY' | 'DIARY' | 'INSPIRATION'
  title: string
  preview: string
  fullContent: string
  date: string
  navPath: string
}

const kindBadge: Record<string, string> = { ESSAY: '散文', DIARY: '日记', INSPIRATION: '灵感' }
const kindColor: Record<string, string> = { ESSAY: '#137333', DIARY: '#d93025', INSPIRATION: '#7c3aed' }

const shardItems = ref<ShardItem[]>([])
const isLoading = ref(true)
const phase = ref(0) // 0=nothing, 1=line grown, 2=circles, 3=lines, 4=text

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function loadAll() {
  isLoading.value = true
  try {
    const [articleRes, inspRes] = await Promise.all([
      http.get('/articles', { params: { type: 'ESSAY,DIARY' } }),
      http.get('/inspirations'),
    ])
    const articles = (articleRes.data || []) as any[]
    const inspirations = (inspRes.data || []) as any[]

    const items: ShardItem[] = []
    for (const a of articles) {
      if (['ESSAY', 'DIARY'].includes(a.type)) {
        items.push({
          id: a.id, kind: a.type as 'ESSAY' | 'DIARY',
          title: a.title, preview: (a.body || '').substring(0, 100), fullContent: a.body || '',
          date: a.createdAt, navPath: a.type === 'ESSAY' ? `/writing/essay/${a.id}` : `/writing/diary/${a.id}`,
        })
      }
    }
    for (const ins of inspirations) {
      items.push({
        id: ins.id, kind: 'INSPIRATION',
        title: '灵感', preview: (ins.content || '').substring(0, 100), fullContent: ins.content || '',
        date: ins.createdAt, navPath: '/create/inspiration',
      })
    }
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    shardItems.value = items
  } catch { /* */ } finally {
    isLoading.value = false
  }
}

function goItem(item: ShardItem) {
  if (item.kind === 'INSPIRATION') {
    selectedInsp.value = { content: item.fullContent, date: formatDate(item.date) }
    showInspDetail.value = true
    return
  }
  router.push(item.navPath)
}

// ============ Inspiration detail modal ============
const showInspDetail = ref(false)
const selectedInsp = ref({ content: '', date: '' })
function closeInspDetail() { showInspDetail.value = false }

onMounted(async () => {
  await loadAll()
  await nextTick()
  if (shardItems.value.length === 0) return

  // Phase 1: line grows
  setTimeout(() => { phase.value = 1 }, 100)
  // Phase 2: circles appear (staggered)
  setTimeout(() => { phase.value = 2 }, 600)
  // Phase 3: horizontal lines grow
  setTimeout(() => { phase.value = 3 }, 600 + Math.min(shardItems.value.length * 120, 1200))
  // Phase 4: text animates in
  setTimeout(() => { phase.value = 4 }, 600 + Math.min(shardItems.value.length * 120, 1200) + 400)
})
</script>

<template>
  <div class="shard-page">
    <div class="shard-header">
      <button class="btn-back" @click="router.push('/writing')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        返回
      </button>
      <h1 class="shard-page-title">碎片拾取</h1>
      <div class="header-spacer"></div>
    </div>

    <div v-if="isLoading" class="loading-state">加载中...</div>
    <div v-else-if="shardItems.length === 0" class="empty-state">
      <span class="empty-icon">🧩</span>
      <span>暂无碎片</span>
    </div>

    <div v-else class="timeline" :class="`phase-${phase}`">
      <!-- The root vertical line -->
      <div class="timeline-line-bar">
        <div class="timeline-line"></div>
      </div>

      <div class="timeline-items">
        <div
          v-for="(item, idx) in shardItems"
          :key="`${item.kind}-${item.id}`"
          class="tl-item"
          :style="{ '--delay': `${idx * 120}ms` }"
          @click="goItem(item)"
        >
          <!-- Circle on the line -->
          <div class="tl-dot" :style="{ borderColor: kindColor[item.kind] }">
            <div v-if="phase >= 2" class="tl-dot-inner"></div>
          </div>
          <!-- Horizontal connector + content -->
          <div class="tl-connector" :style="{ background: kindColor[item.kind] }"></div>
          <div class="tl-content">
            <div class="tl-top">
              <span class="tl-kind" :style="{ background: kindColor[item.kind] }">{{ kindBadge[item.kind] }}</span>
              <span class="tl-title">{{ item.title }}</span>
              <span class="tl-date">{{ formatDate(item.date) }}</span>
            </div>
            <div class="tl-preview">{{ item.preview }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== INSPIRATION DETAIL MODAL ===== -->
    <Teleport to="body">
      <Transition name="insp-modal">
        <div v-if="showInspDetail" class="insp-overlay" @click.self="closeInspDetail">
          <div class="insp-detail-card">
            <div class="insp-detail-header">
              <span class="insp-detail-label">💡 灵感</span>
              <span class="insp-detail-date">{{ selectedInsp.date }}</span>
            </div>
            <div class="insp-detail-body">{{ selectedInsp.content }}</div>
            <div class="insp-detail-actions">
              <button class="btn-close" @click="closeInspDetail">关闭</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.shard-page { max-width: 800px; margin: 0 auto; padding: 24px 20px 48px; }

.shard-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 32px;
}
.shard-page-title { font-size: 24px; font-weight: 700; color: #202124; margin: 0; letter-spacing: 2px; }
.header-spacer { width: 80px; }

.btn-back {
  display: flex; align-items: center; gap: 4px;
  background: none; border: none; font-size: 14px; color: #1a73e8;
  cursor: pointer; padding: 6px 12px; border-radius: 6px; font-family: inherit;
  transition: background 0.2s;
}
.btn-back:hover { background: #e8f0fe; }

.loading-state, .empty-state { text-align: center; padding: 80px 20px; color: #999; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.empty-icon { font-size: 48px; }

/* ===== TIMELINE ===== */
.timeline { position: relative; padding-left: 40px; }

/* ---- Vertical line container ---- */
.timeline-line-bar { position: absolute; left: 16px; top: 0; bottom: 0; width: 2px; overflow: hidden; pointer-events: none; }
.timeline-line {
  width: 100%; height: 100%; background: linear-gradient(to bottom, #9aa0a6 0%, #dadce0 100%);
  transform: scaleY(0); transform-origin: top;
  transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}
.phase-1 .timeline-line,
.phase-2 .timeline-line,
.phase-3 .timeline-line,
.phase-4 .timeline-line {
  transform: scaleY(1);
}

/* ---- Items ---- */
.timeline-items { display: flex; flex-direction: column; gap: 0; }

.tl-item {
  position: relative; display: grid;
  grid-template-columns: 24px 1fr;
  gap: 0 16px;
  padding: 20px 0 20px 0;
  cursor: pointer;
}

/* ---- Dot (circle) ---- */
.tl-dot {
  width: 18px; height: 18px; border-radius: 50%;
  border: 3px solid #dadce0; background: #fff;
  position: relative; z-index: 2; pointer-events: none;
  margin-top: 4px; margin-left: -9px;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
  transform: scale(0); opacity: 0;
}
.phase-2 .tl-dot,
.phase-3 .tl-dot,
.phase-4 .tl-dot {
  transform: scale(1); opacity: 1;
}
.tl-dot {
  transition-delay: var(--delay);
}

.tl-dot-inner {
  position: absolute; inset: 3px; border-radius: 50%;
  background: #9aa0a6;
  transform: scale(0);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.phase-3 .tl-dot-inner,
.phase-4 .tl-dot-inner {
  transform: scale(1);
}
.tl-dot-inner {
  transition-delay: calc(var(--delay) + 300ms);
}

/* ---- Horizontal connector ---- */
.tl-connector {
  position: absolute; left: 6px; top: 32px; pointer-events: none;
  width: 20px; height: 2px;
  transform: scaleX(0); transform-origin: left;
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.phase-3 .tl-connector,
.phase-4 .tl-connector {
  transform: scaleX(1);
}
.tl-connector {
  transition-delay: calc(var(--delay) + 200ms);
}

/* ---- Content ---- */
.tl-content {
  grid-column: 2;
  min-width: 0;
}

/* Top row: badge + title + date */
.tl-top {
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
  opacity: 0; transform: translateY(-8px);
  transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.phase-4 .tl-top {
  opacity: 1; transform: translateY(0);
}
.tl-top { transition-delay: calc(var(--delay) + 350ms); }

.tl-kind {
  font-size: 11px; font-weight: 500; color: #fff; padding: 2px 8px;
  border-radius: 4px; white-space: nowrap;
}
.tl-title { font-size: 15px; font-weight: 600; color: #202124; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.tl-date { font-size: 12px; color: #999; white-space: nowrap; }

/* Bottom row: preview */
.tl-preview {
  font-size: 13px; color: #5f6368; line-height: 1.6;
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  opacity: 0; transform: translateY(8px);
  transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.phase-4 .tl-preview {
  opacity: 1; transform: translateY(0);
}
.tl-preview { transition-delay: calc(var(--delay) + 450ms); }

/* ---- Hover ---- */
.tl-item:hover .tl-dot { box-shadow: 0 0 0 6px rgba(120, 130, 150, 0.15); }
.tl-item:hover .tl-title { color: #5f6368; }

/* ===== INSPIRATION DETAIL MODAL ===== */
.insp-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0,0,0,0.4); display: flex; align-items: center;
  justify-content: center; padding: 24px; backdrop-filter: blur(4px);
}
.insp-detail-card {
  background: #fff; border-radius: 16px; padding: 28px 28px 20px;
  width: 100%; max-width: 520px; max-height: 80vh; overflow-y: auto;
  box-shadow: 0 16px 48px rgba(0,0,0,0.15);
}
.insp-detail-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #e8eaed;
}
.insp-detail-label { font-size: 16px; font-weight: 600; color: #202124; }
.insp-detail-date { font-size: 13px; color: #999; }
.insp-detail-body {
  font-size: 15px; line-height: 1.8; color: #333;
  white-space: pre-wrap; word-break: break-word; margin-bottom: 24px;
}
.insp-detail-actions { display: flex; justify-content: center; }
.btn-close {
  padding: 10px 32px; background: #f1f3f4; border: none; border-radius: 8px;
  font-size: 14px; color: #5f6368; cursor: pointer; font-family: inherit;
}
.btn-close:hover { background: #e8eaed; color: #202124; }

.insp-modal-enter-active { transition: opacity 0.25s ease; }
.insp-modal-enter-active .insp-detail-card { transition: transform 0.3s ease, opacity 0.25s ease; }
.insp-modal-leave-active { transition: opacity 0.2s ease; }
.insp-modal-leave-active .insp-detail-card { transition: transform 0.2s ease, opacity 0.2s ease; }
.insp-modal-enter-from { opacity: 0; }
.insp-modal-enter-from .insp-detail-card { transform: scale(0.92) translateY(20px); opacity: 0; }
.insp-modal-leave-to { opacity: 0; }
.insp-modal-leave-to .insp-detail-card { transform: scale(0.95); opacity: 0; }

/* ---- Responsive ---- */
@media (max-width: 640px) {
  .shard-page { padding: 16px 12px; }
  .timeline { padding-left: 28px; }
  .tl-top { flex-wrap: wrap; }
}
</style>
