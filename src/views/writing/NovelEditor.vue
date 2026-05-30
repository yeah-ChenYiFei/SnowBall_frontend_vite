<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import http from '@/api/http'
import type { World } from '@/types'
import { toChineseNum } from '@/utils/chapterCodec'

/* ================================================================
   Types
   ================================================================ */
const DEFAULT_SECTIONS = ['main', 'preface', 'extra', 'postscript'] as const
const DEFAULT_LABELS: Record<string, string> = {
  main: '正文', preface: '前言', extra: '番外', postscript: '后记',
}

interface ChapterItem {
  postId: number; section: string; volume: number; chapter: number
  title: string; body: string; wordCount: number
}

/* ================================================================
   Router / State
   ================================================================ */
const router = useRouter()
const route = useRoute()
const editId = computed(() => { const id = route.params.id; return id && id !== 'new' ? Number(id) : null })
const isLoading = ref(false)
const novelId = ref<number | null>(null)
const novelTitle = ref('')
const novelHasVolumes = ref(false)
const isPublished = ref(false)
const worldId = ref<number | null>(null)
const worldName = ref('')
const accessibleWorlds = ref<World[]>([])

// Dynamic sections
// Dynamic ordered sections — start with 4 defaults, all editable+deletable+reorderable
const sectionOrder = ref<string[]>([...DEFAULT_SECTIONS])
const sectionLabels = (s: string) => DEFAULT_LABELS[s] || s

// Chapter state
const sectionType = ref('main')
const currentVolume = ref(1)
const currentChapter = ref(1)
const chapterTitle = ref('')
const chapterBody = ref('')
const chapters = ref<ChapterItem[]>([])

// Tools
const fontSize = ref('16')
const lineHeight = ref('1.8')

// AI
const aiOutput = ref(''); const aiLoading = ref(false); const aiPrompt = ref('')

// Submit
const isSubmitting = ref(false); const message = ref('')
const autoSavedAt = ref(''); let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
const isDirty = ref(false)

// Outline collapse + section settings
const collapsedSections = ref<Set<string>>(new Set())
const showSectionSettings = ref(false)
const newSectionName = ref('')

/* ================================================================
   Computed
   ================================================================ */
const wordCount = computed(() => chapterBody.value.length)
const totalStats = computed(() => {
  let w = 0; for (const c of chapters.value) w += c.wordCount
  return { words: w, count: chapters.value.length }
})

const chaptersBySection = computed(() => {
  const map = new Map<string, ChapterItem[]>()
  for (const s of sectionOrder.value) map.set(s, [])
  for (const c of chapters.value) {
    const arr = map.get(c.section)
    if (arr) arr.push(c); else { const na: ChapterItem[] = [c]; map.set(c.section, na) }
  }
  return map
})

const chapterMap = computed(() => {
  const m = new Map<string, number>()
  for (const c of chapters.value) {
    const k = `${c.section}:${novelHasVolumes.value ? c.volume : 0}`
    const cur = m.get(k) ?? 0; if (c.chapter > cur) m.set(k, c.chapter)
  }
  return m
})

const currentScopeKey = computed(() => `${sectionType.value}:${novelHasVolumes.value ? currentVolume.value : 0}`)
const maxChapterInScope = computed(() => chapterMap.value.get(currentScopeKey.value) ?? 0)
const nextChapterNumber = computed(() => maxChapterInScope.value + 1)

const existingPostId = computed(() => {
  return chapters.value.find(c => c.section === sectionType.value &&
    (novelHasVolumes.value ? c.volume === currentVolume.value : true) &&
    c.chapter === currentChapter.value)?.postId ?? null
})

const selectableVolumes = computed(() => {
  if (!novelHasVolumes.value) return [] as number[]
  const vols = new Set<number>()
  for (const [k] of chapterMap.value) { if (k.startsWith(sectionType.value + ':')) { const v = parseInt(k.split(':')[1]); if (v > 0) vols.add(v) } }
  const arr = [...vols].sort((a, b) => a - b)
  if (arr.length === 0) arr.push(1)
  if (!arr.includes(arr[arr.length - 1] + 1)) arr.push(arr[arr.length - 1] + 1)
  return arr
})

const selectableChapters = computed(() => {
  const chs: number[] = []; const max = maxChapterInScope.value
  for (let i = 1; i <= max + 1; i++) chs.push(i); return chs
})

const sortedChapters = computed(() => {
  return [...chapters.value].sort((a, b) => {
    const ia = sectionOrder.value.indexOf(a.section), ib = sectionOrder.value.indexOf(b.section)
    if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    if (a.volume !== b.volume) return a.volume - b.volume
    return a.chapter - b.chapter
  })
})

const currentNavIndex = computed(() => sortedChapters.value.findIndex(
  c => c.section === sectionType.value && (novelHasVolumes.value ? c.volume === currentVolume.value : true) && c.chapter === currentChapter.value))
const hasPrev = computed(() => currentNavIndex.value > 0)
const hasNext = computed(() => currentNavIndex.value >= 0 && currentNavIndex.value < sortedChapters.value.length - 1)
const taStyle = computed(() => ({ fontSize: fontSize.value + 'px', lineHeight: lineHeight.value }))

/* ================================================================
   Load
   ================================================================ */
async function loadWorlds() {
  try { const r = await http.get<World[]>('/worlds'); accessibleWorlds.value = r.data || [] } catch {/* */}
}
async function loadNovel(nid: number) {
  isLoading.value = true
  try {
    const r = await http.get(`/novels/${nid}`)
    const d = r.data as any
    novelId.value = d.id; novelTitle.value = d.title; novelHasVolumes.value = d.hasVolumes || false
    isPublished.value = d.isPublished || false; worldId.value = d.worldId || null; worldName.value = d.worldName || ''
    chapters.value = (d.chapters || []).map((c: any) => ({ postId: c.id, section: c.section, volume: c.volumeNumber, chapter: c.chapterNumber, title: c.title, body: c.body || '', wordCount: (c.body || '').length }))
    // Collect custom sections from data
    const seen = new Set(sectionOrder.value)
    for (const c of chapters.value) { if (!seen.has(c.section)) { seen.add(c.section); sectionOrder.value.push(c.section) } }
    if (chapters.value.length > 0) { const f = chapters.value[0]; sectionType.value = f.section; currentVolume.value = f.volume || 1; currentChapter.value = f.chapter; loadChapterContent() }
    else resetChapter()
  } catch (e: any) { message.value = e.message || '加载失败' }
  finally { isLoading.value = false }
}
function loadChapterContent() {
  const e = chapters.value.find(c => c.section === sectionType.value && (novelHasVolumes.value ? c.volume === currentVolume.value : true) && c.chapter === currentChapter.value)
  if (e) { chapterTitle.value = e.title; chapterBody.value = e.body } else { chapterTitle.value = ''; chapterBody.value = '' }
}
function resetChapter() { sectionType.value = 'main'; currentVolume.value = 1; currentChapter.value = 1; chapterTitle.value = ''; chapterBody.value = '' }

/* ================================================================
   Save
   ================================================================ */
function updateLocalChapter(postId: number | null, p: { section: string; volumeNumber: number; chapterNumber: number; title: string; body: string }) {
  const wc = p.body.length
  const idx = chapters.value.findIndex(c =>
    c.section === p.section && c.volume === p.volumeNumber && c.chapter === p.chapterNumber
  )
  if (idx >= 0) {
    chapters.value[idx].title = p.title; chapters.value[idx].body = p.body; chapters.value[idx].wordCount = wc
  }
}

async function saveChapter() {
  if (!chapterBody.value.trim()) { message.value = '章节内容不能为空'; return }
  if (!novelId.value) return
  isSubmitting.value = true; message.value = ''
  try {
    const p = { section: sectionType.value, volumeNumber: novelHasVolumes.value ? currentVolume.value : 0, chapterNumber: currentChapter.value, title: chapterTitle.value, body: chapterBody.value }
    if (existingPostId.value) await http.put(`/novels/chapters/${existingPostId.value}`, { title: chapterTitle.value, body: chapterBody.value })
    else await http.post(`/novels/${novelId.value}/chapters`, p)
    updateLocalChapter(existingPostId.value, p)
    autoSavedAt.value = new Date().toLocaleTimeString(); isDirty.value = false
    message.value = '已保存'; setTimeout(() => { message.value = '' }, 2000)
  } catch (e: any) { message.value = e.message || '保存失败' }
  finally { isSubmitting.value = false }
}

/* ================================================================
   Navigation
   ================================================================ */
function switchSection(s: string) { if (s === sectionType.value) return; sectionType.value = s; currentVolume.value = selectableVolumes.value[0] || 1; currentChapter.value = nextChapterNumber.value; chapterTitle.value = ''; chapterBody.value = '' }
function onVolChange() { currentChapter.value = nextChapterNumber.value; loadChapterContent() }
function onChChange() { loadChapterContent() }
function goPrev() { if (!hasPrev.value) return; const p = sortedChapters.value[currentNavIndex.value - 1]; sectionType.value = p.section; currentVolume.value = p.volume || 1; currentChapter.value = p.chapter; loadChapterContent() }
function goNext() { if (!hasNext.value) return; const n = sortedChapters.value[currentNavIndex.value + 1]; sectionType.value = n.section; currentVolume.value = n.volume || 1; currentChapter.value = n.chapter; loadChapterContent() }
function jumpToChapter(c: ChapterItem) { sectionType.value = c.section; currentVolume.value = c.volume || 1; currentChapter.value = c.chapter; loadChapterContent() }
function newChapter() { currentChapter.value = nextChapterNumber.value; chapterTitle.value = ''; chapterBody.value = ''; isDirty.value = false }
function toggleSection(s: string) { const set = collapsedSections.value; if (set.has(s)) set.delete(s); else set.add(s) }

/* ================================================================
   Section settings
   ================================================================ */
function addNewSection() {
  const n = newSectionName.value.trim(); if (!n || sectionOrder.value.includes(n)) return
  sectionOrder.value.push(n); newSectionName.value = ''
}
function deleteSection(s: string) {
  const cnt = chapters.value.filter(c => c.section === s).length
  if (cnt > 0 && !confirm(`"${sectionLabels(s)}" 下有${cnt}章，确定删除？`)) return
  if (!cnt && !confirm(`确定删除分组"${sectionLabels(s)}"？`)) return
  sectionOrder.value = sectionOrder.value.filter(x => x !== s)
  if (sectionType.value === s) { sectionType.value = sectionOrder.value[0] || 'main'; resetChapter() }
}
function moveSection(idx: number, dir: -1 | 1) {
  const newIdx = idx + dir
  if (newIdx < 0 || newIdx >= sectionOrder.value.length) return
  const arr = sectionOrder.value
  const item = arr[idx]
  arr.splice(idx, 1)
  arr.splice(newIdx, 0, item)
}

/* ================================================================
   AI / Publish / World
   ================================================================ */
async function handleAi() {
  if (!novelId.value) { message.value = '请先保存章节'; return }
  aiLoading.value = true; aiOutput.value = ''
  try { const r = await http.post('/ai/continue', { novelId: novelId.value, currentBody: chapterBody.value, prompt: aiPrompt.value.trim() || undefined }, { timeout: 120000 }); aiOutput.value = (r.data as any).continuation } catch (e: any) { aiOutput.value = '失败: ' + (e.message || '错误') }
  finally { aiLoading.value = false }
}
function copyAi() { if (!aiOutput.value) return; chapterBody.value = chapterBody.value ? chapterBody.value + '\n\n' + aiOutput.value : aiOutput.value; aiOutput.value = ''; aiPrompt.value = ''; isDirty.value = true; message.value = '已追加'; setTimeout(() => { message.value = '' }, 2000) }
async function togglePub() { if (!novelId.value) return; const ep = isPublished.value ? `/novels/${novelId.value}/unpublish` : `/novels/${novelId.value}/publish`; const r = await http.post(ep); isPublished.value = (r.data as any).isPublished }
async function handleUpdateTitle(title: string) { if (!novelId.value || !title.trim()) return; try { await http.put(`/novels/${novelId.value}`, { title: title.trim() }); message.value = '书名已保存'; setTimeout(() => { message.value = '' }, 2000) } catch {/* */} }
const bWorldId = ref(0)
async function bindW() { if (!bWorldId.value || !novelId.value) return; const r = await http.put(`/novels/${novelId.value}/bind-world`, { worldId: bWorldId.value }); const d = r.data as any; worldId.value = d.worldId; worldName.value = d.worldName || ''; bWorldId.value = 0 }
async function unbindW() { if (!novelId.value) return; await http.delete(`/novels/${novelId.value}/bind-world`); worldId.value = null; worldName.value = '' }

/* ================================================================
   Auto-save
   ================================================================ */
watch(chapterBody, () => { isDirty.value = true })
watch(isDirty, (v) => {
  if (v && novelId.value) { if (autoSaveTimer) clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(async () => { if (!chapterBody.value.trim() || !novelId.value) return; try { const p = { section: sectionType.value, volumeNumber: novelHasVolumes.value ? currentVolume.value : 0, chapterNumber: currentChapter.value, title: chapterTitle.value, body: chapterBody.value }; if (existingPostId.value) await http.put(`/novels/chapters/${existingPostId.value}`, { title: chapterTitle.value, body: chapterBody.value }); else await http.post(`/novels/${novelId.value}/chapters`, p); updateLocalChapter(existingPostId.value, p); autoSavedAt.value = new Date().toLocaleTimeString(); isDirty.value = false } catch {/* */} }, 8000) }
})

onMounted(async () => { await loadWorlds(); if (editId.value) await loadNovel(editId.value) })
</script>

<template>
  <div class="ne-page">
    <!-- ===== HEADER ===== -->
    <header class="ne-header">
      <button class="ne-back" @click="router.push('/writing/novel/new')">← 返回</button>
      <div class="ne-title-group">
        <input v-model="novelTitle" class="ne-title-input" placeholder="书名..."
               @blur="handleUpdateTitle(novelTitle)" />
        <span v-if="autoSavedAt && !isDirty" class="ne-autosave">已保存 {{ autoSavedAt }}</span>
        <span v-else-if="isDirty" class="ne-dirty">未保存</span>
      </div>
      <div class="ne-header-actions">
        <button :class="['ne-pub', { on: isPublished }]" @click="togglePub">{{ isPublished ? '已发布 ✓' : '发布' }}</button>
      </div>
    </header>

    <div v-if="isLoading" class="ne-loading">加载中...</div>
    <div v-if="message" :class="['ne-alert', /成功|已/.test(message) ? 'ok' : 'err']">{{ message }}</div>

    <div v-else class="ne-layout">
      <!-- ===== LEFT: Outline ===== -->
      <aside class="ne-side ne-side-left">
        <div class="ne-outline-hdr">
          <h3>章节大纲</h3>
          <button class="ne-ico-btn" @click="showSectionSettings = true" title="管理分组">☰</button>
        </div>

        <div class="ne-outline">
          <div v-for="s in sectionOrder" :key="s" class="ne-outline-section">
            <div class="ne-outline-section-hdr" @click="toggleSection(s)">
              <span :class="['ne-caret', { open: !collapsedSections.has(s) }]">▸</span>
              <span class="ne-section-label">{{ sectionLabels(s) }}</span>
              <span class="ne-section-count">{{ chaptersBySection.get(s)?.length || 0 }}</span>
            </div>
            <div v-if="!collapsedSections.has(s)" class="ne-outline-chs">
              <div v-for="c in chaptersBySection.get(s)" :key="c.postId"
                   :class="['ne-outline-ch', { active: sectionType === c.section && currentVolume === c.volume && currentChapter === c.chapter }]"
                   @click="jumpToChapter(c)">
                <span class="ne-ch-num">{{ novelHasVolumes && c.volume ? toChineseNum(c.volume) + '卷·' : '' }}{{ toChineseNum(c.chapter) }}章</span>
                <span class="ne-ch-title">{{ c.title || '无标题' }}</span>
                <span class="ne-ch-wc">{{ c.wordCount }}字</span>
              </div>
              <div v-if="!(chaptersBySection.get(s) || []).length" class="ne-outline-empty">暂无章节</div>
            </div>
          </div>
        </div>
      </aside>

      <!-- ===== CENTER: Writing ===== -->
      <div class="ne-center">
        <div class="ne-bar">
          <div class="ne-bar-left">
            <div v-if="novelHasVolumes" class="ne-bar-ctrl">
              <select v-model.number="currentVolume" class="ne-sel ne-sel-h" @change="onVolChange()">
                <option v-for="v in selectableVolumes" :key="v" :value="v">{{ toChineseNum(v) }}卷</option>
              </select>
            </div>
            <div class="ne-bar-ctrl">
              <select v-model.number="currentChapter" class="ne-sel ne-sel-h" @change="onChChange()">
                <option v-for="ch in selectableChapters" :key="ch" :value="ch">{{ toChineseNum(ch) }}章{{ ch > maxChapterInScope ? ' 新' : '' }}</option>
              </select>
            </div>
            <button class="ne-btn ne-btn-icon" @click="newChapter" title="新一章">+</button>
            <span class="ne-bar-sep"></span>
            <button class="ne-btn ne-btn-nav" :disabled="!hasPrev" @click="goPrev">← 上一章</button>
            <button class="ne-btn ne-btn-nav" :disabled="!hasNext" @click="goNext">下一章 →</button>
          </div>
          <div class="ne-bar-right">
            <select v-model="fontSize" class="ne-sel ne-sel-h"><option value="14">14</option><option value="16">16</option><option value="18">18</option><option value="20">20</option></select>
            <select v-model="lineHeight" class="ne-sel ne-sel-h"><option value="1.5">1.5</option><option value="1.8">1.8</option><option value="2.0">2.0</option><option value="2.5">2.5</option></select>
            <span class="ne-wc">{{ wordCount }}字</span>
          </div>
        </div>

        <!-- Chapter title -->
        <input v-model="chapterTitle" class="ne-ct-input" :placeholder="`第${toChineseNum(currentChapter)}章 标题（可留空）`" />

        <!-- Textarea -->
        <textarea v-model="chapterBody" class="ne-ta" :style="taStyle" placeholder="开始书写你的故事..."></textarea>

        <!-- Save -->
        <div class="ne-save-row">
          <button class="ne-save-btn" :disabled="isSubmitting" @click="saveChapter">
            {{ isSubmitting ? '保存中...' : (existingPostId ? '更新章节' : '保存章节') }}
          </button>
        </div>
      </div>

      <!-- ===== RIGHT: Info ===== -->
      <aside class="ne-side ne-side-right">
        <div class="ne-stats">
          <h3>全书统计</h3>
          <div class="ne-sr"><span>章节</span><span>{{ totalStats.count }}</span></div>
          <div class="ne-sr"><span>总字数</span><span>{{ totalStats.words.toLocaleString() }}</span></div>
          <div class="ne-sr"><span>状态</span><span :class="isPublished ? 'green' : ''">{{ isPublished ? '已发布' : '未发布' }}</span></div>
          <div class="ne-sr"><span>世界</span><span :class="worldName ? 'amber cur' : 'dim'" @click="worldName && router.push(`/wild/worlds/${worldId}`)">{{ worldName || '未绑定' }}</span></div>
        </div>

        <div class="ne-wbind">
          <select v-model="bWorldId" class="ne-sel wfull"><option :value="0">绑定到世界...</option><option v-for="w in accessibleWorlds" :key="w.id" :value="w.id">{{ w.name }}</option></select>
          <div class="ne-wb-row">
            <button class="ne-bt-sm amber" @click="bindW" :disabled="bWorldId === 0">绑定</button>
            <button v-if="worldId" class="ne-bt-sm red" @click="unbindW">解绑</button>
          </div>
        </div>

        <div class="ne-ai">
          <h3>🤖 AI 续写</h3>
          <textarea v-model="aiPrompt" class="ne-ai-prompt" rows="2" placeholder="提示词（可选）..."></textarea>
          <div :class="['ne-ai-out', { loading: aiLoading }]">{{ aiLoading ? '续写中...' : aiOutput || 'AI 根据已有内容续写' }}</div>
          <div class="ne-ai-row">
            <button class="ne-ai-btn" :disabled="aiLoading" @click="handleAi">{{ aiLoading ? '...' : 'AI 续写' }}</button>
            <button v-if="aiOutput && !aiLoading" class="ne-ai-copy" @click="copyAi">追加</button>
          </div>
        </div>
      </aside>
    </div>

    <!-- ===== SECTION MANAGEMENT MODAL ===== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showSectionSettings" class="modal-overlay" @click.self="showSectionSettings = false">
          <div class="modal-card">
            <h2>管理分组</h2>
            <p class="modal-hint">可添加自定义分组或删除非默认分组</p>

            <div class="modal-section-list">
              <div v-for="(s, idx) in sectionOrder" :key="s" class="modal-section-row">
                <div class="modal-section-info">
                  <button class="modal-move-btn" @click="moveSection(idx, -1)" :disabled="idx === 0" title="上移">▲</button>
                  <button class="modal-move-btn" @click="moveSection(idx, 1)" :disabled="idx >= sectionOrder.length - 1" title="下移">▼</button>
                  <span class="modal-section-name">{{ sectionLabels(s) }}</span>
                  <span class="modal-section-info-count">{{ chaptersBySection.get(s)?.length || 0 }} 章</span>
                </div>
                <button class="modal-section-del" @click="deleteSection(s)">删除</button>
              </div>
            </div>

            <div class="modal-add-row">
              <input v-model="newSectionName" class="modal-add-input" placeholder="新分组名..."
                     @keyup.enter="addNewSection" />
              <button class="ne-ico-btn" @click="addNewSection">+</button>
            </div>

            <div class="modal-actions">
              <button class="btn-cancel" @click="showSectionSettings = false">完成</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* ===== BASE ===== */
.ne-page { max-width: 1400px; margin: 0 auto; padding: 12px 16px; font-family: inherit; }

/* ===== HEADER ===== */
.ne-header { display: flex; align-items: center; gap: 14px; padding: 8px 0 14px; border-bottom: 1px solid #e8eaed; margin-bottom: 10px; }
.ne-back { background: none; border: none; color: #5f6368; font-size: 13px; cursor: pointer; padding: 4px 8px; border-radius: 5px; font-family: inherit; }
.ne-back:hover { color: #d97706; background: #fef3c7; }
.ne-title-group { flex: 1; display: flex; align-items: center; gap: 8px; }
.ne-title-input { border: none; font-size: 20px; font-weight: 600; color: #202124; outline: none; padding: 4px 6px; border-radius: 4px; background: transparent; width: 320px; font-family: inherit; }
.ne-title-input:focus { background: #f1f3f4; }
.ne-autosave { font-size: 11px; color: #34a853; }
.ne-dirty { font-size: 11px; color: #e37400; }
.ne-header-actions { display: flex; gap: 6px; }
.ne-pub { padding: 6px 14px; border: 1px solid #d97706; background: #fff; color: #d97706; border-radius: 7px; font-size: 12px; cursor: pointer; font-family: inherit; white-space: nowrap; }
.ne-pub:hover { background: #fef3c7; }
.ne-pub.on { background: #fef7e0; color: #92400e; border-color: #fde68a; }

.ne-loading { text-align: center; padding: 80px; color: #999; }
.ne-alert { padding: 6px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 6px; text-align: center; }
.ne-alert.ok { background: #e6f4ea; color: #137333; }
.ne-alert.err { background: #fce8e6; color: #d93025; }

/* ===== LAYOUT ===== */
.ne-layout { display: grid; grid-template-columns: 220px 1fr 260px; gap: 14px; align-items: start; }
.ne-side { position: sticky; top: 12px; }
.ne-side-right { display: flex; flex-direction: column; gap: 12px; }

/* ===== LEFT: Outline ===== */
.ne-outline-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.ne-outline-hdr h3 { margin: 0; font-size: 14px; color: #202124; }
.ne-ico-btn {
  width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #d97706; background: #fff;
  color: #d97706; font-size: 14px; cursor: pointer; display: flex; align-items: center;
  justify-content: center; line-height: 1; transition: all 0.15s; flex-shrink: 0; padding: 0;
}
.ne-ico-btn:hover { background: #d97706; color: #fff; }

.ne-outline { max-height: calc(100vh - 220px); overflow-y: auto; padding-right: 2px; }
.ne-outline-section { margin-bottom: 6px; }
.ne-outline-section-hdr { display: flex; align-items: center; gap: 3px; padding: 5px 3px; cursor: pointer; border-radius: 5px; font-size: 13px; }
.ne-outline-section-hdr:hover { background: #f1f3f4; }
.ne-caret { font-size: 9px; color: #999; transition: transform 0.15s; width: 12px; text-align: center; }
.ne-caret.open { transform: rotate(90deg); }
.ne-section-label { font-weight: 600; color: #5f6368; }
.ne-section-count { font-size: 11px; color: #999; margin-left: auto; }
.ne-outline-chs { padding-left: 14px; }
.ne-outline-ch {
  display: flex; flex-direction: column; padding: 5px 7px; border-radius: 5px;
  cursor: pointer; border-left: 2px solid transparent; font-size: 12px; transition: all 0.1s;
}
.ne-outline-ch:hover { background: #f1f3f4; }
.ne-outline-ch.active { background: #fef3c7; border-left-color: #d97706; }
.ne-ch-num { color: #999; }
.ne-ch-title { color: #202124; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ne-ch-wc { font-size: 10px; color: #999; }
.ne-outline-empty { font-size: 11px; color: #bdc1c6; padding: 6px; }

/* ===== CENTER: Writing ===== */
.ne-center { min-width: 0; }
.ne-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 14px; background: #fff; border: 1px solid #e8eaed; border-radius: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.ne-bar-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ne-bar-right { display: flex; align-items: center; gap: 8px; }
.ne-bar-ctrl { }
.ne-bar-sep { width: 1px; height: 24px; background: #e8eaed; margin: 0 2px; }

.ne-btn { color: #d97706; cursor: pointer; font-family: inherit; border-radius: 6px; transition: all 0.15s; display: inline-flex; align-items: center; justify-content: center; }
.ne-btn:hover:not(:disabled) { background: #fef3c7; }
.ne-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.ne-btn-icon { width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid #d97706; background: #fff; font-size: 16px; padding: 0; flex-shrink: 0; }
.ne-btn-icon:hover { background: #d97706; color: #fff; }
.ne-btn-nav { padding: 6px 12px; border: 1px solid #dadce0; background: #fff; font-size: 13px; white-space: nowrap; }

.ne-sel { padding: 4px 6px; border: 1px solid #dadce0; border-radius: 6px; font-size: 13px; outline: none; background: #fff; font-family: inherit; cursor: pointer; }
.ne-sel:focus { border-color: #d97706; }
.ne-sel-h { height: 30px; font-size: 13px; }

.ne-wc { font-size: 12px; color: #999; }
.ne-saved { font-size: 11px; color: #34a853; }
.ne-dirty { font-size: 11px; color: #e37400; }

.ne-ct-input { width: 100%; padding: 7px 10px; border: 1px solid #e8eaed; border-radius: 6px; font-size: 14px; outline: none; font-family: inherit; box-sizing: border-box; margin-bottom: 6px; }
.ne-ct-input:focus { border-color: #d97706; }
.ne-ct-input::placeholder { color: #bdc1c6; }

.ne-ta { width: 100%; min-height: 460px; padding: 14px; border: 1px solid #e8eaed; border-radius: 8px; font-size: 15px; line-height: 1.8; color: #202124; outline: none; resize: vertical; font-family: inherit; box-sizing: border-box; }
.ne-ta:focus { border-color: #d97706; box-shadow: 0 0 0 3px rgba(217,119,6,0.06); }
.ne-ta::placeholder { color: #bdc1c6; }

.ne-save-row { display: flex; justify-content: center; margin-top: 12px; }
.ne-save-btn { padding: 11px 40px; background: #d97706; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.2s; box-shadow: 0 2px 10px rgba(217,119,6,0.22); }
.ne-save-btn:hover:not(:disabled) { background: #b45309; }
.ne-save-btn:disabled { background: #fde68a; cursor: not-allowed; box-shadow: none; }

/* ===== RIGHT: Info ===== */
.ne-stats { background: #f8f9fa; border: 1px solid #e8eaed; border-radius: 10px; padding: 14px; }
.ne-stats h3 { margin: 0 0 10px 0; font-size: 13px; color: #202124; }
.ne-sr { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; color: #5f6368; }
.ne-sr .green { color: #137333; }
.ne-sr .amber { color: #d97706; }
.ne-sr .cur { cursor: pointer; }
.ne-sr .dim { color: #999; }

.ne-wbind { }
.wfull { width: 100%; margin-bottom: 5px; }
.ne-wb-row { display: flex; gap: 5px; }
.ne-bt-sm { flex: 1; padding: 5px 0; border: none; border-radius: 5px; font-size: 11px; cursor: pointer; font-family: inherit; }
.ne-bt-sm.amber { background: #d97706; color: #fff; }
.ne-bt-sm.amber:hover:not(:disabled) { background: #b45309; }
.ne-bt-sm.amber:disabled { opacity: 0.5; cursor: not-allowed; }
.ne-bt-sm.red { background: #fff; color: #d93025; border: 1px solid #f28b82; }
.ne-bt-sm.red:hover { background: #fce8e6; }

.ne-ai { background: #f8f9fa; border: 1px solid #e8eaed; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; }
.ne-ai h3 { margin: 0 0 8px 0; font-size: 13px; color: #202124; }
.ne-ai-prompt { width: 100%; padding: 6px 8px; border: 1px solid #e8eaed; border-radius: 5px; font-size: 11px; resize: none; outline: none; font-family: inherit; box-sizing: border-box; margin-bottom: 6px; background: #fff; }
.ne-ai-prompt:focus { border-color: #d97706; }
.ne-ai-out { padding: 8px 10px; font-size: 12px; line-height: 1.6; color: #202124; white-space: pre-wrap; word-break: break-word; overflow-y: auto; min-height: 120px; max-height: 240px; background: #fff; border: 1px solid #e8eaed; border-radius: 5px; margin-bottom: 8px; }
.ne-ai-out.loading { display: flex; align-items: center; justify-content: center; color: #d97706; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
.ne-ai-row { display: flex; gap: 6px; }
.ne-ai-btn { flex: 1; padding: 8px 0; background: linear-gradient(135deg, #d97706, #f59e0b); color: #fff; border: none; border-radius: 7px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; }
.ne-ai-btn:hover:not(:disabled) { transform: translateY(-1px); }
.ne-ai-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.ne-ai-copy { padding: 8px 10px; background: #fff; color: #d97706; border: 1px solid #fde68a; border-radius: 7px; font-size: 12px; cursor: pointer; white-space: nowrap; font-family: inherit; }
.ne-ai-copy:hover { background: #fef3c7; border-color: #d97706; }

/* ===== SECTION MANAGEMENT MODAL ===== */
.modal-overlay { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.25); backdrop-filter: blur(4px); padding: 24px; }
.modal-card { background: #fff; border-radius: 14px; padding: 26px 28px 20px; width: 100%; max-width: 420px; box-shadow: 0 16px 48px rgba(0,0,0,0.15); }
.modal-card h2 { margin: 0 0 4px 0; font-size: 18px; color: #202124; }
.modal-hint { font-size: 12px; color: #999; margin: 0 0 16px 0; }
.modal-section-list { max-height: 240px; overflow-y: auto; margin-bottom: 14px; border: 1px solid #e8eaed; border-radius: 8px; }
.modal-section-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #f1f3f4; }
.modal-section-row:last-child { border-bottom: none; }
.modal-section-info { display: flex; align-items: center; gap: 6px; }
.modal-move-btn { background: none; border: 1px solid #dadce0; color: #5f6368; cursor: pointer; padding: 2px 4px; border-radius: 3px; font-size: 9px; font-family: inherit; flex-shrink: 0; }
.modal-move-btn:hover:not(:disabled) { border-color: #d97706; color: #d97706; }
.modal-move-btn:disabled { opacity: 0.25; cursor: not-allowed; }
.modal-section-name { font-size: 14px; font-weight: 500; color: #202124; }
.modal-section-info-count { font-size: 12px; color: #999; }
.modal-section-del { padding: 4px 10px; border: 1px solid #f28b82; background: #fff; color: #d93025; border-radius: 4px; font-size: 11px; cursor: pointer; font-family: inherit; }
.modal-section-del:hover { background: #fce8e6; }
.modal-add-row { display: flex; gap: 6px; margin-bottom: 16px; }
.modal-add-input { flex: 1; padding: 7px 10px; border: 1px solid #dadce0; border-radius: 6px; font-size: 13px; outline: none; font-family: inherit; }
.modal-add-input:focus { border-color: #d97706; }
.modal-actions { display: flex; justify-content: flex-end; }
.btn-cancel { padding: 8px 20px; border: 1px solid #dadce0; background: #fff; color: #5f6368; border-radius: 7px; font-size: 13px; cursor: pointer; font-family: inherit; }
.btn-cancel:hover { background: #f1f3f4; }

/* Modal transitions */
.modal-enter-active { transition: opacity 0.25s; }
.modal-enter-active .modal-card { transition: transform 0.3s, opacity 0.25s; }
.modal-leave-active { transition: opacity 0.2s; }
.modal-leave-active .modal-card { transition: transform 0.2s, opacity 0.15s; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .modal-card { transform: translateY(16px) scale(0.96); opacity: 0; }
.modal-leave-to { opacity: 0; }
.modal-leave-to .modal-card { transform: translateY(8px) scale(0.97); opacity: 0; }

@media (max-width: 960px) { .ne-layout { grid-template-columns: 1fr; } .ne-side { position: static; } .ne-outline { max-height: 200px; } }
@media (max-width: 500px) { .ne-bar { flex-wrap: wrap; } }
</style>
