<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import type { World, WorldEntry, WorldRelation, Collaborator, WorldChange, ArticleFull } from '@/types'
import WorldCollaboratorModal from '@/components/WorldCollaboratorModal.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'

/* ================================================================
   Constants
   ================================================================ */
const DEFAULT_TYPES = ['人物', '地理', '历史', '物品', '生物', '规则', '故事点', '其他']
const MAX_VISIBLE_TYPES = 8

/* ================================================================
   State
   ================================================================ */
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const worldId = Number(route.params.worldId)

// Tabs
type Tab = 'entries' | 'graph' | 'manage'
const activeTab = ref<Tab>('entries')

// World
const world = ref<World | null>(null)
const isWorldCreator = computed(() => world.value?.userId === userStore.userInfo?.id)
const message = ref('')

// Edit world
const showEditWorld = ref(false)
const editWorldForm = ref({ name: '', description: '', type: '', isPublic: true })
const editWorldMsg = ref('')
const editWorldSaving = ref(false)

// Entries
const entries = ref<WorldEntry[]>([])
const customTypes = ref<string[]>([])
const selectedType = ref('')
const searchKeyword = ref('')

const allTypes = computed(() => [...new Set([...DEFAULT_TYPES, ...customTypes.value])])
const visibleTypes = computed(() => allTypes.value.slice(0, MAX_VISIBLE_TYPES))
const overflowTypes = computed(() => allTypes.value.slice(MAX_VISIBLE_TYPES))
const showMoreTypes = ref(false)

// Entry create
const showEntryModal = ref(false)
const entryForm = ref({ name: '', type: '', content: '' })
const showNewEntryType = ref(false)
const newEntryType = ref('')
const entrySubmitting = ref(false)

// Entry edit (inline)
const editingEntryId = ref<number | null>(null)
const editEntryForm = ref({ name: '', type: '', content: '' })
const editEntrySaving = ref(false)

// Entry quick view modal
const viewingEntry = ref<WorldEntry | null>(null)

// Relations
const relations = ref<WorldRelation[]>([])
const showRelationModal = ref(false)
const relationView = ref<'list' | 'create'>('list')
const pickerFor = ref<'from' | 'to' | null>(null)
const relForm = ref({ fromEntryId: null as number | null, toEntryId: null as number | null, direction: 'LEFT_ARROW', description: '' })
const pickerSearch = ref('')
const pickerType = ref('')
const createMsg = ref('')

// Edit relation
const showEditRel = ref(false)
const editRel = ref<WorldRelation | null>(null)
const editRelForm = ref({ fromEntryId: null as number | null, toEntryId: null as number | null, direction: 'LEFT_ARROW', description: '' })
const editPickerFor = ref<'from' | 'to' | null>(null)
const editPickSearch = ref('')
const editPickType = ref('')
const editRelMsg = ref('')
const editRelSaving = ref(false)

// Graph
const graphPan = ref({ x: 0, y: 0 })
const graphScale = ref(1)
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const hoveredEdge = ref<number | null>(null)

// Collaborators
const showCollab = ref(false)
const collaborators = ref<Collaborator[]>([])

// Changes
const changes = ref<WorldChange[]>([])

// Bound articles
const boundArticles = ref<ArticleFull[]>([])

// AI stories
interface AiStory { id: string; content: string; prompt: string; entryNames: string; createdAt: string }
const aiStoryHistory = ref<AiStory[]>([])
const showAiModal = ref(false)
const aiPrompt = ref('')
const aiSelected = ref<number[]>([])
const aiLoading = ref(false)
const aiResult = ref('')

/* ================================================================
   Computed
   ================================================================ */
const directionLabel: Record<string, string> = { LEFT_ARROW: '←', RIGHT_ARROW: '→', BIDIRECTIONAL: '↔' }
const directionText: Record<string, string> = { LEFT_ARROW: '右是左的...', RIGHT_ARROW: '左是右的...', BIDIRECTIONAL: '彼此是...' }
const changeTypeLabel: Record<string, string> = { CREATE: '新增', UPDATE: '修改', DELETE: '删除' }

const filteredEntries = computed(() => {
  let list = entries.value
  if (pickerType.value) list = list.filter(e => e.type === pickerType.value)
  if (pickerSearch.value) list = list.filter(e => e.name.includes(pickerSearch.value))
  return list
})

const editFilteredEntries = computed(() => {
  let list = entries.value
  if (editPickType.value) list = list.filter(e => e.type === editPickType.value)
  if (editPickSearch.value) list = list.filter(e => e.name.includes(editPickSearch.value))
  return list
})

// Graph nodes/edges
const graphNodes = computed(() => {
  const set = new Set<number>()
  relations.value.forEach(r => { set.add(r.fromEntryId); set.add(r.toEntryId) })
  const nodes = Array.from(set).map(id => {
    const e = entries.value.find(x => x.id === id)
    return { id, name: e?.name || '未知' }
  })
  const count = nodes.length
  const radius = Math.max(100, count * 16)
  const cx = 230, cy = 260
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    n.x = cx + radius * Math.cos(angle)
    n.y = cy + radius * Math.sin(angle)
  })
  return nodes
})

const graphEdges = computed(() => relations.value.map(r => ({
  id: r.id, fromId: r.fromEntryId, toId: r.toEntryId, direction: r.direction, label: r.description,
})))

const nodeMap = computed(() => {
  const m: Record<number, { x: number; y: number }> = {}
  graphNodes.value.forEach(n => { m[n.id] = { x: n.x, y: n.y } })
  return m
})

function getEntryName(id: number | null) {
  if (!id) return '点击选择'
  return entries.value.find(e => e.id === id)?.name || '未知'
}

/* ================================================================
   Data Loading
   ================================================================ */
async function loadWorld() {
  try { const res = await http.get(`/worlds/${worldId}`); world.value = res.data } catch (e: any) { message.value = e.message || '加载失败' }
}

async function loadEntries() {
  try {
    const params = new URLSearchParams()
    if (selectedType.value) params.set('type', selectedType.value)
    if (searchKeyword.value) params.set('search', searchKeyword.value)
    const res = await http.get(`/worlds/${worldId}/entries?${params.toString()}`)
    entries.value = res.data || []
  } catch { /* */ }
}

async function loadTypes() {
  try {
    const res = await http.get(`/worlds/${worldId}/entries/types`)
    customTypes.value = (res.data || []).filter((t: string) => !DEFAULT_TYPES.includes(t))
  } catch { /* */ }
}

async function loadRelations() {
  try { const res = await http.get(`/worlds/${worldId}/relations`); relations.value = res.data || [] } catch { /* */ }
}

async function loadCollaborators() {
  try { const res = await http.get(`/worlds/${worldId}/collaborators`); collaborators.value = res.data || [] } catch { /* */ }
}

async function loadChanges() {
  try { const res = await http.get(`/worlds/${worldId}/changes`); changes.value = res.data || [] } catch { /* */ }
}

async function loadBoundArticles() {
  try { const res = await http.get(`/articles/by-world/${worldId}`); boundArticles.value = res.data || [] } catch { /* */ }
}

/* ================================================================
   World actions
   ================================================================ */
async function toggleWorldPublic(v: boolean) {
  if (!world.value) return
  try { await http.put(`/worlds/${worldId}`, { isPublic: v }); world.value.isPublic = v } catch { /* */ }
}

function openEditWorld() {
  if (!world.value) return
  editWorldForm.value = { name: world.value.name, description: world.value.description, type: world.value.type, isPublic: world.value.isPublic }
  editWorldMsg.value = ''; showEditWorld.value = true
}

async function saveEditWorld() {
  if (!editWorldForm.value.name.trim()) { editWorldMsg.value = '名称不能为空'; return }
  editWorldSaving.value = true
  try {
    const res = await http.put(`/worlds/${worldId}`, editWorldForm.value)
    world.value = res.data; showEditWorld.value = false
  } catch (e: any) { editWorldMsg.value = e.message || '保存失败' }
  finally { editWorldSaving.value = false }
}

async function deleteWorld() {
  if (!confirm(`确定要删除世界「${world.value?.name}」及其所有数据吗？`)) return
  try { await http.delete(`/worlds/${worldId}`); router.push('/create/setting') } catch (e: any) { message.value = e.message || '删除失败' }
}

/* ================================================================
   Entry actions
   ================================================================ */
function selectTypeFilter(t: string) { selectedType.value = selectedType.value === t ? '' : t; loadEntries() }

function openEntryModal() {
  entryForm.value = { name: '', type: '', content: '' }; showNewEntryType.value = false
  newEntryType.value = ''; showEntryModal.value = true
}

async function createEntry() {
  if (!entryForm.value.name.trim() || !entryForm.value.content.trim()) { message.value = '名称和内容不能为空'; return }
  if (!entryForm.value.type) { message.value = '请选择类型'; return }
  entrySubmitting.value = true
  try {
    await http.post(`/worlds/${worldId}/entries`, entryForm.value)
    showEntryModal.value = false; loadEntries(); loadTypes()
  } catch (e: any) { message.value = e.message || '创建失败' }
  finally { entrySubmitting.value = false }
}

function startNewEntryType() { newEntryType.value = ''; showNewEntryType.value = true }
function confirmNewType() {
  const t = newEntryType.value.trim()
  if (t && !allTypes.value.includes(t)) { customTypes.value.push(t); entryForm.value.type = t }
  showNewEntryType.value = false
}

function viewEntry(e: WorldEntry) { viewingEntry.value = e }

function editEntryInline(e: WorldEntry) {
  editingEntryId.value = e.id; editEntryForm.value = { name: e.name, type: e.type, content: e.content }
  editEntrySaving.value = false
  nextTick(() => { document.getElementById('edit-entry-textarea')?.focus() })
}

async function saveEditEntry() {
  if (!editingEntryId.value) return
  editEntrySaving.value = true
  try {
    const res = await http.put(`/worlds/${worldId}/entries/${editingEntryId.value}`, editEntryForm.value)
    editingEntryId.value = null
    const updated = res.data as WorldEntry
    const idx = entries.value.findIndex(e => e.id === updated.id)
    if (idx >= 0) entries.value[idx] = updated
    loadTypes(); loadRelations()
  } catch (e: any) { message.value = e.message || '保存失败' }
  finally { editEntrySaving.value = false }
}

async function deleteEntry(e: WorldEntry) {
  if (!confirm(`确定要删除「${e.name}」吗？`)) return
  try { await http.delete(`/worlds/${worldId}/entries/${e.id}`); loadEntries(); loadTypes(); loadRelations() } catch { /* */ }
}

/* ================================================================
   Relation actions
   ================================================================ */
function openRelModal() { relationView.value = 'list'; showRelationModal.value = true }

function startCreateRel() {
  relForm.value = { fromEntryId: null, toEntryId: null, direction: 'LEFT_ARROW', description: '' }
  pickerSearch.value = ''; pickerType.value = ''; createMsg.value = ''; relationView.value = 'create'
}

function selectEntryForRel(id: number) {
  if (pickerFor.value === 'from') {
    if (id === relForm.value.toEntryId) { createMsg.value = '不能选择相同设定'; return }
    relForm.value.fromEntryId = id; pickerFor.value = null
  } else if (pickerFor.value === 'to') {
    if (id === relForm.value.fromEntryId) { createMsg.value = '不能选择相同设定'; return }
    relForm.value.toEntryId = id; pickerFor.value = null
  }
}

async function createRelation() {
  if (!relForm.value.fromEntryId || !relForm.value.toEntryId) { createMsg.value = '请选择两个设定'; return }
  if (!relForm.value.description.trim()) { createMsg.value = '请输入关系描述'; return }
  try {
    await http.post(`/worlds/${worldId}/relations`, relForm.value)
    relationView.value = 'list'; loadRelations()
  } catch (e: any) { createMsg.value = e.message || '创建失败' }
}

function openEditRel(r: WorldRelation) {
  editRel.value = r; editRelForm.value = { fromEntryId: r.fromEntryId, toEntryId: r.toEntryId, direction: r.direction, description: r.description }
  editPickerFor.value = null; editPickSearch.value = ''; editPickType.value = ''; editRelMsg.value = ''; showEditRel.value = true
}

function selectEditEntry(id: number) {
  if (editPickerFor.value === 'from') {
    if (id === editRelForm.value.toEntryId) { editRelMsg.value = '不能选择相同设定'; return }
    editRelForm.value.fromEntryId = id; editPickerFor.value = null
  } else if (editPickerFor.value === 'to') {
    if (id === editRelForm.value.fromEntryId) { editRelMsg.value = '不能选择相同设定'; return }
    editRelForm.value.toEntryId = id; editPickerFor.value = null
  }
}

async function saveEditRel() {
  if (!editRelForm.value.fromEntryId || !editRelForm.value.toEntryId) { editRelMsg.value = '请选择两个设定'; return }
  if (!editRelForm.value.description.trim()) { editRelMsg.value = '请输入关系描述'; return }
  editRelSaving.value = true
  try {
    await http.put(`/worlds/${worldId}/relations/${editRel.value!.id}`, editRelForm.value)
    showEditRel.value = false; loadRelations()
  } catch (e: any) { editRelMsg.value = e.message || '保存失败' }
  finally { editRelSaving.value = false }
}

async function deleteRel(r: WorldRelation) {
  if (!confirm('确定删除这条关系吗？')) return
  try { await http.delete(`/worlds/${worldId}/relations/${r.id}`); loadRelations() } catch { /* */ }
}

/* ================================================================
   Collaborator actions
   ================================================================ */
async function removeCollaborator(userId: number) {
  try { await http.delete(`/worlds/${worldId}/collaborators/${userId}`); loadCollaborators() } catch (e: any) { alert(e.message || '移除失败') }
}

/* ================================================================
   Change actions
   ================================================================ */
async function approveChange(id: number) {
  try { await http.put(`/worlds/${worldId}/changes/${id}/approve`); await Promise.all([loadChanges(), loadEntries()]) } catch { /* */ }
}

async function rejectChange(id: number) {
  try { await http.put(`/worlds/${worldId}/changes/${id}/reject`, { action: 'REJECT' }); loadChanges() } catch { /* */ }
}

/* ================================================================
   AI Story
   ================================================================ */
function loadAiHistory() {
  try { const raw = localStorage.getItem(`ai_stories_${worldId}`); aiStoryHistory.value = raw ? JSON.parse(raw) : [] } catch { aiStoryHistory.value = [] }
}
function saveAiStory(story: AiStory) { aiStoryHistory.value.unshift(story); localStorage.setItem(`ai_stories_${worldId}`, JSON.stringify(aiStoryHistory.value)) }
function deleteAiStory(id: string) { aiStoryHistory.value = aiStoryHistory.value.filter(s => s.id !== id); localStorage.setItem(`ai_stories_${worldId}`, JSON.stringify(aiStoryHistory.value)) }
function toggleAiEntry(id: number) { const i = aiSelected.value.indexOf(id); if (i >= 0) aiSelected.value.splice(i, 1); else aiSelected.value.push(id) }

async function handleAiGenerate() {
  aiLoading.value = true; aiResult.value = ''
  try {
    const res = await http.post('/ai/world-story', {
      worldId, entryIds: aiSelected.value.length > 0 ? aiSelected.value : undefined,
      prompt: aiPrompt.value || undefined,
    }, { timeout: 120000 })
    aiResult.value = (res.data as any).continuation
    const names = entries.value.filter(e => aiSelected.value.includes(e.id)).map(e => e.name).join('、')
    saveAiStory({ id: Date.now().toString(), content: aiResult.value, prompt: aiPrompt.value, entryNames: names || '全部设定', createdAt: new Date().toISOString() })
  } catch (e: any) { alert('AI创作失败: ' + (e.message || '未知错误')) }
  finally { aiLoading.value = false }
}

/* ================================================================
   Graph interactions
   ================================================================ */
function onGraphMouseDown(e: MouseEvent) {
  const t = e.target as SVGElement
  if (t.classList.contains('graph-bg')) { dragging.value = true; dragStart.value = { x: e.clientX - graphPan.value.x, y: e.clientY - graphPan.value.y } }
}
function onGraphMouseMove(e: MouseEvent) { if (!dragging.value) return; graphPan.value = { x: e.clientX - dragStart.value.x, y: e.clientY - dragStart.value.y } }
function onGraphMouseUp() { dragging.value = false }
function onGraphWheel(e: WheelEvent) { e.preventDefault(); graphScale.value = Math.max(0.3, Math.min(2, graphScale.value - e.deltaY * 0.001)) }

/* ================================================================
   Lifecycle
   ================================================================ */
onMounted(() => {
  loadWorld(); loadEntries(); loadTypes(); loadRelations()
  loadCollaborators(); loadChanges(); loadBoundArticles(); loadAiHistory()
})
</script>

<template>
  <div class="wd-page">
    <!-- ===== HEADER ===== -->
    <header class="wd-header-bar">
      <button class="wd-back" @click="router.push('/create/setting')">← 返回</button>
      <div class="wd-header-mid">
        <h1 class="wd-name">{{ world?.name || '加载中...' }}</h1>
        <div class="wd-meta-row">
          <span v-if="world?.type" class="wd-type-tag">{{ world.type }}</span>
          <span class="wd-desc">{{ world?.description || '暂无简介' }}</span>
        </div>
      </div>
      <div class="wd-header-actions">
        <label v-if="isWorldCreator" class="wd-public-toggle" @click.stop>
          <span class="wd-public-label">公开</span>
          <ToggleSwitch :model-value="world?.isPublic ?? false" @update:model-value="toggleWorldPublic" />
        </label>
        <button v-if="isWorldCreator" class="wd-header-btn" @click="openEditWorld">⚙️</button>
      </div>
    </header>

    <!-- ===== TABS ===== -->
    <div class="wd-tabs">
      <button :class="['wd-tab', { active: activeTab === 'entries' }]" @click="activeTab = 'entries'">📋 设定</button>
      <button :class="['wd-tab', { active: activeTab === 'graph' }]" @click="activeTab = 'graph'">🔗 关系图</button>
      <button :class="['wd-tab', { active: activeTab === 'manage' }]" @click="activeTab = 'manage'">⚙️ 管理</button>
    </div>

    <div v-if="message" class="wd-toast">{{ message }}</div>

    <!-- ===================================================================================================
         TAB: ENTRIES
         =================================================================================================== -->
    <div v-if="activeTab === 'entries'" class="wd-entries-layout">
      <!-- Filter bar -->
      <div class="wd-filter-bar">
        <div class="type-chips">
          <button v-for="t in visibleTypes" :key="t" :class="['type-chip', { active: selectedType === t }]" @click="selectTypeFilter(t)">{{ t }}</button>
          <button v-if="overflowTypes.length > 0" class="type-chip type-chip-more" @click="showMoreTypes = true">+{{ overflowTypes.length }}</button>
          <button class="type-chip type-chip-add" @click="startNewEntryType(); showMoreTypes = false">+</button>
        </div>
        <div class="wd-search">
          <input v-model="searchKeyword" type="text" class="wd-search-input" placeholder="搜索设定..." @keyup.enter="loadEntries" />
        </div>
        <button class="wd-btn-primary wd-add-btn" @click="openEntryModal">+ 添加设定</button>
      </div>

      <!-- More types -->
      <teleport to="body">
        <transition name="modal">
          <div v-if="showMoreTypes" class="modal-overlay" @click.self="showMoreTypes = false">
            <div class="modal-box modal-sm">
              <h3>所有类型</h3>
              <div class="type-chips type-chips-grid">
                <button v-for="t in allTypes" :key="t" :class="['type-chip', { active: selectedType === t }]" @click="selectTypeFilter(t); showMoreTypes = false">{{ t }}</button>
              </div>
              <button class="btn-cancel" @click="showMoreTypes = false" style="width:100%">关闭</button>
            </div>
          </div>
        </transition>
      </teleport>

      <!-- Entry list -->
      <div class="wd-entry-grid">
        <div v-if="entries.length === 0" class="wd-empty">暂无设定条目，点击上方按钮添加</div>
        <div v-for="e in entries" :key="e.id" class="wd-entry-card" @click="viewEntry(e)">
          <div class="ec-head">
            <span class="ec-name">{{ e.name }}</span>
            <span v-if="e.type" class="ec-type">{{ e.type }}</span>
            <div class="ec-actions" @click.stop>
              <button class="ec-btn" @click="editEntryInline(e)" title="编辑">✏️</button>
              <button v-if="isWorldCreator" class="ec-btn del" @click="deleteEntry(e)" title="删除">✕</button>
            </div>
          </div>
          <div class="ec-preview">{{ e.contentPreview || (e.content || '').substring(0, 120) }}</div>
        </div>
      </div>

      <!-- Inline edit entry -->
      <div v-if="editingEntryId" class="wd-inline-edit">
        <div class="ie-header">
          <h3>编辑设定</h3>
          <button class="btn-cancel" @click="editingEntryId = null">取消</button>
        </div>
        <div class="ie-field">
          <input v-model="editEntryForm.name" class="ie-input" placeholder="设定名称" />
        </div>
        <div class="ie-field">
          <select v-model="editEntryForm.type" class="ie-select">
            <option value="">类型</option>
            <option v-for="t in allTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="ie-field">
          <textarea id="edit-entry-textarea" v-model="editEntryForm.content" class="ie-textarea" rows="12" placeholder="详细内容..."></textarea>
        </div>
        <button class="wd-btn-primary" @click="saveEditEntry" :disabled="editEntrySaving">
          {{ editEntrySaving ? '保存中...' : '保存' }}
        </button>
      </div>

      <!-- Quick view entry modal -->
      <teleport to="body">
        <transition name="modal">
          <div v-if="viewingEntry" class="modal-overlay" @click.self="viewingEntry = null">
            <div class="modal-box modal-md">
              <div class="qv-header">
                <div>
                  <h2>{{ viewingEntry.name }}</h2>
                  <span v-if="viewingEntry.type" class="qv-type">{{ viewingEntry.type }}</span>
                </div>
                <button class="btn-close" @click="viewingEntry = null">✕</button>
              </div>
              <div class="qv-body">{{ viewingEntry.content }}</div>
            </div>
          </div>
        </transition>
      </teleport>

      <!-- Relations section -->
      <div class="wd-section">
        <div class="wd-section-header">
          <h3>关系列表</h3>
          <button class="wd-btn-secondary" @click="openRelModal">+ 管理关系</button>
        </div>
        <div v-if="relations.length === 0" class="wd-empty sm">暂无关系</div>
        <div v-else class="rel-strip">
          <div v-for="r in relations" :key="r.id" class="rel-chip" @click="openEditRel(r)">
            <span>{{ r.fromEntryName }}</span>
            <span class="rel-arrow-sm">{{ directionLabel[r.direction] }}</span>
            <span>{{ r.toEntryName }}</span>
            <span class="rel-desc-sm">{{ r.description }}</span>
          </div>
        </div>
      </div>

      <!-- AI Story section -->
      <div class="wd-section">
        <div class="wd-section-header">
          <h3>🤖 AI 创作故事</h3>
          <button class="wd-btn-accent" @click="showAiModal = true; aiResult = ''; aiSelected = []">✨ 创作</button>
        </div>
        <div v-if="aiStoryHistory.length === 0" class="wd-empty sm">AI 可根据设定自动生成故事片段</div>
        <div v-else class="ai-hist-list">
          <div v-for="s in aiStoryHistory.slice(0, 3)" :key="s.id" class="ai-hist-item">
            <div class="ai-hist-head">
              <span class="ai-hist-badge">AI</span>
              <span class="ai-hist-entries">{{ s.entryNames }}</span>
              <span class="ai-hist-time">{{ new Date(s.createdAt).toLocaleString('zh-CN') }}</span>
              <button class="ai-hist-del" @click="deleteAiStory(s.id)">×</button>
            </div>
            <div class="ai-hist-preview">{{ s.content?.substring(0, 120) }}...</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===================================================================================================
         TAB: GRAPH
         =================================================================================================== -->
    <div v-if="activeTab === 'graph'" class="wd-graph-tab">
      <div v-if="relations.length === 0" class="wd-empty">暂无关系数据</div>
      <div v-else class="graph-container" ref="graphContainer">
        <svg class="graph-svg" viewBox="0 0 460 520"
             @mousedown="onGraphMouseDown" @mousemove="onGraphMouseMove"
             @mouseup="onGraphMouseUp" @mouseleave="onGraphMouseUp" @wheel="onGraphWheel">
          <rect class="graph-bg" x="0" y="0" width="460" height="520" fill="transparent" />
          <g :transform="`translate(${graphPan.x},${graphPan.y}) scale(${graphScale})`">
            <g v-for="edge in graphEdges" :key="'e'+edge.id" style="cursor:pointer"
               @click.stop="openEditRel(relations.find(r => r.id === edge.id)!)">
              <line v-if="nodeMap[edge.fromId] && nodeMap[edge.toId]"
                    :x1="nodeMap[edge.fromId].x" :y1="nodeMap[edge.fromId].y"
                    :x2="nodeMap[edge.toId].x" :y2="nodeMap[edge.toId].y"
                    :class="['graph-edge', 'edge-'+edge.direction, { hov: hoveredEdge === edge.id }]"
                    @mouseenter="hoveredEdge = edge.id" @mouseleave="hoveredEdge = null" />
              <text v-if="nodeMap[edge.fromId] && nodeMap[edge.toId]"
                    :x="(nodeMap[edge.fromId].x + nodeMap[edge.toId].x)/2"
                    :y="(nodeMap[edge.fromId].y + nodeMap[edge.toId].y)/2 - 8"
                    :class="['edge-label', { hov: hoveredEdge === edge.id }]"
                    text-anchor="middle"
                    @mouseenter="hoveredEdge = edge.id" @mouseleave="hoveredEdge = null">{{ edge.label }}</text>
            </g>
            <g v-for="node in graphNodes" :key="'n'+node.id" class="graph-node-g"
               @click="router.push(`/create/setting/${worldId}/entry/${node.id}`)">
              <circle :cx="node.x" :cy="node.y" r="20" class="graph-node" />
              <text :x="node.x" :y="node.y + 5" class="graph-node-text" text-anchor="middle">{{ node.name.length > 3 ? node.name.slice(0,3)+'..' : node.name }}</text>
              <text :x="node.x" :y="node.y + 34" class="graph-node-label" text-anchor="middle">{{ node.name }}</text>
            </g>
          </g>
        </svg>
      </div>
    </div>

    <!-- ===================================================================================================
         TAB: MANAGE
         =================================================================================================== -->
    <div v-if="activeTab === 'manage'" class="wd-manage-tab">
      <!-- Info -->
      <div class="mg-card">
        <h3>世界信息</h3>
        <div class="mg-field"><label>名称</label><span>{{ world?.name }}</span></div>
        <div class="mg-field"><label>类型</label><span>{{ world?.type || '未设置' }}</span></div>
        <div class="mg-field"><label>简介</label><span>{{ world?.description || '无' }}</span></div>
        <div class="mg-field"><label>公开</label><span>{{ world?.isPublic ? '是' : '否' }}</span></div>
        <div class="mg-field"><label>设定数</label><span>{{ entries.length }}</span></div>
        <div class="mg-field"><label>关系数</label><span>{{ relations.length }}</span></div>
        <div class="mg-actions">
          <button v-if="isWorldCreator" class="wd-btn-secondary" @click="openEditWorld">编辑世界</button>
          <button v-if="isWorldCreator" class="wd-btn-danger" @click="deleteWorld">删除世界</button>
        </div>
      </div>

      <!-- Collaborators -->
      <div class="mg-card" v-if="isWorldCreator">
        <h3>👥 共创者 ({{ collaborators.length }})</h3>
        <div v-if="collaborators.length === 0" class="wd-empty sm">暂无共创者</div>
        <div v-for="c in collaborators" :key="c.userId" class="mg-row">
          <span>{{ c.username || '用户'+c.userId }}</span>
          <button class="mg-btn-del" @click="removeCollaborator(c.userId)">移除</button>
        </div>
        <button class="wd-btn-secondary" @click="showCollab = true" style="margin-top:12px">+ 添加共创者</button>
      </div>

      <!-- Pending changes -->
      <div class="mg-card" v-if="isWorldCreator && changes.filter(c => c.status === 'PENDING').length > 0">
        <h3>📋 待审批修改 ({{ changes.filter(c => c.status === 'PENDING').length }})</h3>
        <div v-for="c in changes.filter(c => c.status === 'PENDING')" :key="c.id" class="mg-change">
          <div class="mg-change-head">
            <span :class="['mg-change-type', 'type-'+c.changeType]">{{ changeTypeLabel[c.changeType] }}</span>
            <span>{{ c.username }}</span>
            <span class="mg-change-time">{{ new Date(c.createdAt).toLocaleString() }}</span>
          </div>
          <div class="mg-change-body">
            <strong>{{ c.entryName }}</strong>
            <p>{{ (c.entryContent || '').substring(0, 200) }}</p>
          </div>
          <div class="mg-change-actions">
            <button class="wd-btn-primary sm" @click="approveChange(c.id)">同意</button>
            <button class="wd-btn-danger sm" @click="rejectChange(c.id)">拒绝</button>
          </div>
        </div>
      </div>

      <!-- Bound articles -->
      <div class="mg-card">
        <h3>📖 绑定小说</h3>
        <div v-if="boundArticles.length === 0" class="wd-empty sm">暂无绑定</div>
        <div v-for="a in boundArticles" :key="a.id" class="mg-row clickable" @click="router.push(`/writing/novel/${a.id}`)">
          <span>{{ a.type === 'NOVEL' ? '📘' : '📝' }} {{ a.title }}</span>
          <span class="mg-meta">{{ a.authorName }}</span>
        </div>
      </div>
    </div>

    <!-- ===================================================================================================
         MODALS
         =================================================================================================== -->

    <!-- Edit world -->
    <teleport to="body">
      <transition name="modal">
        <div v-if="showEditWorld" class="modal-overlay" @click.self="showEditWorld = false">
          <div class="modal-box">
            <h2>编辑世界</h2>
            <div v-if="editWorldMsg" class="modal-error">{{ editWorldMsg }}</div>
            <div class="form-row"><label>名称</label><input v-model="editWorldForm.name" type="text" class="form-input" /></div>
            <div class="form-row"><label>类型</label><input v-model="editWorldForm.type" type="text" class="form-input" /></div>
            <div class="form-row"><label>简介</label><textarea v-model="editWorldForm.description" class="form-input form-textarea" rows="3"></textarea></div>
            <div class="form-row-inline">
              <label>公开</label>
              <ToggleSwitch v-model="editWorldForm.isPublic" />
            </div>
            <div class="modal-actions">
              <button class="btn-cancel" @click="showEditWorld = false">取消</button>
              <button class="wd-btn-primary" @click="saveEditWorld" :disabled="editWorldSaving">{{ editWorldSaving ? '保存中...' : '保存' }}</button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- Entry modal -->
    <teleport to="body">
      <transition name="modal">
        <div v-if="showEntryModal" class="modal-overlay" @click.self="showEntryModal = false">
          <div class="modal-box">
            <h2>添加设定</h2>
            <div class="form-row"><label>名称</label><input v-model="entryForm.name" class="form-input" placeholder="如：主角小明" /></div>
            <div class="form-row">
              <label>类型</label>
              <select v-model="entryForm.type" class="form-input"><option value="" disabled>选择类型</option><option v-for="t in allTypes" :key="t" :value="t">{{ t }}</option></select>
              <button v-if="!showNewEntryType" class="btn-new-type" @click="startNewEntryType" style="margin-top:6px">+ 新类型</button>
              <div v-if="showNewEntryType" class="new-type-row">
                <input v-model="newEntryType" class="form-input" placeholder="输入新类型" @keyup.enter="confirmNewType" />
                <button class="wd-btn-primary sm" @click="confirmNewType">确定</button>
                <button class="btn-cancel sm" @click="showNewEntryType = false">取消</button>
              </div>
            </div>
            <div class="form-row"><label>内容</label><textarea v-model="entryForm.content" class="form-input form-textarea" rows="10" placeholder="详细描述..."></textarea></div>
            <div class="modal-actions">
              <button class="btn-cancel" @click="showEntryModal = false">取消</button>
              <button class="wd-btn-primary" @click="createEntry" :disabled="entrySubmitting">{{ entrySubmitting ? '创建中...' : '创建' }}</button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- Relations modal -->
    <teleport to="body">
      <transition name="modal">
        <div v-if="showRelationModal" class="modal-overlay" @click.self="showRelationModal = false">
          <div class="modal-box modal-lg">
            <template v-if="relationView === 'list'">
              <div class="modal-header"><h2>设定关系</h2><button class="btn-close" @click="showRelationModal = false">✕</button></div>
              <div v-if="relations.length === 0" class="wd-empty">暂无关系</div>
              <div class="rel-list">
                <div v-for="r in relations" :key="r.id" class="rel-row">
                  <span class="rel-name">{{ r.fromEntryName }}</span>
                  <span class="rel-arrow">{{ directionLabel[r.direction] }}</span>
                  <span class="rel-name">{{ r.toEntryName }}</span>
                  <span class="rel-desc">{{ r.description }}</span>
                  <div class="rel-row-actions">
                    <button class="ec-btn" @click="openEditRel(r)">✏️</button>
                    <button v-if="isWorldCreator" class="ec-btn del" @click="deleteRel(r)">✕</button>
                  </div>
                </div>
              </div>
              <div class="modal-actions">
                <button class="wd-btn-primary" @click="startCreateRel">+ 添加关系</button>
              </div>
            </template>
            <template v-else>
              <div class="modal-header"><h2>新建关系</h2><button class="btn-close" @click="showRelationModal = false">✕</button></div>
              <div v-if="createMsg" class="modal-error">{{ createMsg }}</div>
              <div class="rel-create">
                <div class="rel-picker" :class="{ selected: relForm.fromEntryId }" @click="pickerFor = 'from'">
                  <div class="rel-picker-label">{{ getEntryName(relForm.fromEntryId) }}</div>
                  <div class="rel-picker-hint">点击选设定</div>
                </div>
                <div class="rel-arrows">
                  <button :class="{ active: relForm.direction === 'LEFT_ARROW' }" @click="relForm.direction = 'LEFT_ARROW'">←</button>
                  <button :class="{ active: relForm.direction === 'BIDIRECTIONAL' }" @click="relForm.direction = 'BIDIRECTIONAL'">↔</button>
                  <button :class="{ active: relForm.direction === 'RIGHT_ARROW' }" @click="relForm.direction = 'RIGHT_ARROW'">→</button>
                </div>
                <div class="rel-picker" :class="{ selected: relForm.toEntryId }" @click="pickerFor = 'to'">
                  <div class="rel-picker-label">{{ getEntryName(relForm.toEntryId) }}</div>
                  <div class="rel-picker-hint">点击选设定</div>
                </div>
                <div class="rel-desc-row">
                  <label>{{ directionText[relForm.direction] }}</label>
                  <input v-model="relForm.description" class="form-input" placeholder="关系描述..." />
                </div>
              </div>
              <transition name="slide">
                <div v-if="pickerFor" class="picker-panel">
                  <div class="picker-head"><span>选择设定</span><button class="btn-close" @click="pickerFor = null">✕</button></div>
                  <div class="picker-filters">
                    <div class="type-chips">
                      <button v-for="t in allTypes" :key="t" :class="['type-chip', { active: pickerType === t }]" @click="pickerType = pickerType === t ? '' : t">{{ t }}</button>
                    </div>
                    <input v-model="pickerSearch" class="wd-search-input" placeholder="搜索..." />
                  </div>
                  <div class="picker-list">
                    <div v-for="e in filteredEntries" :key="e.id" class="picker-item" @click="selectEntryForRel(e.id)">
                      <span>{{ e.name }}</span><span class="picker-type">{{ e.type }}</span>
                    </div>
                  </div>
                </div>
              </transition>
              <div class="modal-actions">
                <button class="btn-cancel" @click="relationView = 'list'">返回</button>
                <button class="wd-btn-primary" @click="createRelation">确认</button>
              </div>
            </template>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- Edit relation modal -->
    <teleport to="body">
      <transition name="modal">
        <div v-if="showEditRel" class="modal-overlay" @click.self="showEditRel = false">
          <div class="modal-box modal-lg">
            <div class="modal-header"><h2>编辑关系</h2><button class="btn-close" @click="showEditRel = false">✕</button></div>
            <div v-if="editRelMsg" class="modal-error">{{ editRelMsg }}</div>
            <div class="rel-create">
              <div class="rel-picker" :class="{ selected: editRelForm.fromEntryId }" @click="editPickerFor = 'from'">
                <div class="rel-picker-label">{{ getEntryName(editRelForm.fromEntryId) }}</div>
                <div class="rel-picker-hint">点击更换</div>
              </div>
              <div class="rel-arrows">
                <button :class="{ active: editRelForm.direction === 'LEFT_ARROW' }" @click="editRelForm.direction = 'LEFT_ARROW'">←</button>
                <button :class="{ active: editRelForm.direction === 'BIDIRECTIONAL' }" @click="editRelForm.direction = 'BIDIRECTIONAL'">↔</button>
                <button :class="{ active: editRelForm.direction === 'RIGHT_ARROW' }" @click="editRelForm.direction = 'RIGHT_ARROW'">→</button>
              </div>
              <div class="rel-picker" :class="{ selected: editRelForm.toEntryId }" @click="editPickerFor = 'to'">
                <div class="rel-picker-label">{{ getEntryName(editRelForm.toEntryId) }}</div>
                <div class="rel-picker-hint">点击更换</div>
              </div>
              <div class="rel-desc-row">
                <label>{{ directionText[editRelForm.direction] }}</label>
                <input v-model="editRelForm.description" class="form-input" placeholder="关系描述..." />
              </div>
            </div>
            <transition name="slide">
              <div v-if="editPickerFor" class="picker-panel">
                <div class="picker-head"><span>选择设定</span><button class="btn-close" @click="editPickerFor = null">✕</button></div>
                <div class="picker-filters">
                  <div class="type-chips">
                    <button v-for="t in allTypes" :key="t" :class="['type-chip', { active: editPickType === t }]" @click="editPickType = editPickType === t ? '' : t">{{ t }}</button>
                  </div>
                  <input v-model="editPickSearch" class="wd-search-input" placeholder="搜索..." />
                </div>
                <div class="picker-list">
                  <div v-for="e in editFilteredEntries" :key="e.id" class="picker-item" @click="selectEditEntry(e.id)">
                    <span>{{ e.name }}</span><span class="picker-type">{{ e.type }}</span>
                  </div>
                </div>
              </div>
            </transition>
            <div class="modal-actions">
              <button v-if="isWorldCreator" class="btn-danger" @click="deleteRel(editRel!); showEditRel = false">删除</button>
              <div class="modal-actions-right">
                <button class="btn-cancel" @click="showEditRel = false">取消</button>
                <button class="wd-btn-primary" @click="saveEditRel" :disabled="editRelSaving">{{ editRelSaving ? '保存中...' : '保存' }}</button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- AI Story modal -->
    <teleport to="body">
      <transition name="modal">
        <div v-if="showAiModal" class="modal-overlay" @click.self="showAiModal = false">
          <div class="modal-box ai-modal">
            <h2>🤖 AI 创作故事</h2>
            <template v-if="!aiResult">
              <p class="ai-desc">选择设定条目让 AI 根据它们创作故事片段</p>
              <div class="ai-select-entries">
                <div v-for="e in entries" :key="e.id" :class="['ai-chip', { sel: aiSelected.includes(e.id) }]" @click="toggleAiEntry(e.id)">
                  {{ e.name }} <span class="ai-chip-type">{{ e.type }}</span>
                </div>
              </div>
              <div class="form-row" style="margin-top:16px">
                <label>提示词（可选）</label>
                <textarea v-model="aiPrompt" class="form-input form-textarea" rows="3" placeholder="描述想要的故事情节..."></textarea>
              </div>
              <div class="modal-actions">
                <button class="btn-cancel" @click="showAiModal = false">取消</button>
                <button class="wd-btn-accent" @click="handleAiGenerate" :disabled="aiLoading">{{ aiLoading ? '创作中...' : '✨ 开始创作' }}</button>
              </div>
            </template>
            <template v-else>
              <div class="ai-result"><p v-for="(line, i) in aiResult.split('\n')" :key="i">{{ line }}</p></div>
              <div class="modal-actions">
                <button class="btn-cancel" @click="handleAiGenerate">🔄 重新创作</button>
                <button class="wd-btn-primary" @click="showAiModal = false">关闭</button>
              </div>
            </template>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- Collaborator modal -->
    <WorldCollaboratorModal
      :show="showCollab" :world-id="worldId" :existing-collaborators="collaborators"
      @close="showCollab = false" @added="loadCollaborators" />
  </div>
</template>

<style scoped>
/* ===== LAYOUT ===== */
.wd-page { max-width: 1100px; margin: 0 auto; padding: 20px; }

/* ===== HEADER ===== */
.wd-header-bar { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
.wd-back { background: none; border: none; color: #5f6368; font-size: 14px; cursor: pointer; padding: 6px 10px; border-radius: 6px; font-family: inherit; white-space: nowrap; }
.wd-back:hover { color: #1a73e8; background: #e8f0fe; }
.wd-header-mid { flex: 1; }
.wd-name { font-size: 24px; font-weight: 700; color: #202124; margin: 0 0 4px 0; }
.wd-meta-row { display: flex; align-items: center; gap: 8px; }
.wd-type-tag { font-size: 12px; padding: 2px 8px; background: rgba(26,115,232,0.1); color: #1a73e8; border-radius: 10px; }
.wd-desc { font-size: 13px; color: #5f6368; }
.wd-header-actions { display: flex; align-items: center; gap: 8px; }
.wd-public-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.wd-public-label { font-size: 12px; color: #999; }
.wd-header-btn { background: #fff; border: 1px solid #dadce0; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 14px; }

/* ===== TABS ===== */
.wd-tabs { display: flex; gap: 4px; margin-bottom: 20px; background: #f1f3f4; border-radius: 10px; padding: 4px; }
.wd-tab { flex: 1; padding: 10px 16px; border: none; background: transparent; border-radius: 8px; font-size: 14px; font-weight: 500; color: #5f6368; cursor: pointer; font-family: inherit; transition: all 0.2s; }
.wd-tab.active { background: #fff; color: #1a73e8; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

/* ===== TOAST ===== */
.wd-toast { position: fixed; top: 80px; right: 24px; z-index: 3000; padding: 10px 20px; border-radius: 8px; font-size: 14px; color: #fff; background: #1a73e8; animation: toast-in 0.3s ease; }
@keyframes toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

/* ===== ENTRIES TAB ===== */
.wd-filter-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.wd-search-input { padding: 6px 12px; border: 1px solid #dadce0; border-radius: 16px; font-size: 13px; outline: none; width: 140px; font-family: inherit; }
.wd-search-input:focus { border-color: #1a73e8; }
.wd-add-btn { margin-left: auto; white-space: nowrap; }

.type-chips { display: flex; gap: 5px; flex-wrap: wrap; }
.type-chip { padding: 4px 10px; border: 1px solid #dadce0; background: #fff; color: #5f6368; border-radius: 14px; font-size: 12px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
.type-chip:hover { border-color: #1a73e8; color: #1a73e8; }
.type-chip.active { background: #1a73e8; color: #fff; border-color: #1a73e8; }
.type-chip-more { color: #1a73e8; font-weight: 500; }
.type-chip-add { color: #1a73e8; border-style: dashed; }
.type-chips-grid { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }

.wd-empty { text-align: center; color: #999; font-size: 14px; padding: 40px 0; }
.wd-empty.sm { padding: 16px 0; font-size: 13px; }

/* Entry cards */
.wd-entry-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 32px; }
.wd-entry-card { background: #fff; border: 1px solid #e8eaed; border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: all 0.15s; }
.wd-entry-card:hover { border-color: #1a73e8; box-shadow: 0 2px 8px rgba(26,115,232,0.06); }
.ec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.ec-name { font-size: 15px; font-weight: 600; color: #202124; }
.ec-type { font-size: 11px; padding: 2px 8px; background: #e8f0fe; color: #1a73e8; border-radius: 10px; }
.ec-actions { margin-left: auto; display: flex; gap: 2px; }
.ec-btn { background: none; border: none; font-size: 13px; color: #999; cursor: pointer; padding: 2px 5px; border-radius: 4px; }
.ec-btn:hover { color: #1a73e8; background: #e8f0fe; }
.ec-btn.del:hover { color: #d93025; background: #fce8e6; }
.ec-preview { font-size: 13px; color: #5f6368; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* Inline edit */
.wd-inline-edit { background: #fff; border: 2px solid #1a73e8; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
.ie-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.ie-header h3 { margin: 0; font-size: 16px; }
.ie-field { margin-bottom: 12px; }
.ie-input { width: 100%; padding: 10px 12px; border: none; border-bottom: 2px solid #e8eaed; font-size: 18px; font-weight: 600; outline: none; font-family: inherit; box-sizing: border-box; }
.ie-input:focus { border-bottom-color: #1a73e8; }
.ie-select { padding: 8px 12px; border: 1px solid #dadce0; border-radius: 6px; font-size: 14px; outline: none; font-family: inherit; }
.ie-textarea { width: 100%; padding: 12px; border: 1px solid #dadce0; border-radius: 8px; font-size: 15px; line-height: 1.8; outline: none; resize: vertical; font-family: inherit; box-sizing: border-box; }
.ie-textarea:focus { border-color: #1a73e8; }

/* Quick view */
.modal-md { width: 560px; }
.qv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.qv-header h2 { margin: 0 0 4px 0; font-size: 20px; }
.qv-type { font-size: 12px; padding: 2px 8px; background: #e8f0fe; color: #1a73e8; border-radius: 10px; }
.qv-body { font-size: 15px; line-height: 1.8; color: #333; white-space: pre-wrap; max-height: 60vh; overflow-y: auto; }

/* ===== SECTIONS (relations, AI) ===== */
.wd-section { margin-bottom: 24px; }
.wd-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.wd-section-header h3 { margin: 0; font-size: 16px; color: #202124; }

/* Relation strip */
.rel-strip { display: flex; flex-wrap: wrap; gap: 8px; }
.rel-chip { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: #f8f9fa; border: 1px solid #e8eaed; border-radius: 8px; cursor: pointer; font-size: 13px; transition: border-color 0.15s; }
.rel-chip:hover { border-color: #1a73e8; }
.rel-arrow-sm { font-weight: 700; color: #1a73e8; }
.rel-desc-sm { color: #999; margin-left: 4px; }

/* AI history */
.ai-hist-list { display: flex; flex-direction: column; gap: 8px; }
.ai-hist-item { background: #f8f9fa; border-radius: 8px; padding: 10px 14px; border: 1px solid #f1f3f4; }
.ai-hist-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.ai-hist-badge { font-size: 10px; padding: 1px 6px; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border-radius: 6px; font-weight: 600; }
.ai-hist-entries { font-size: 12px; color: #5f6368; }
.ai-hist-time { font-size: 11px; color: #999; margin-left: auto; }
.ai-hist-del { background: none; border: none; color: #d93025; cursor: pointer; font-size: 14px; }
.ai-hist-preview { font-size: 13px; color: #333; line-height: 1.5; }

/* ===== GRAPH TAB ===== */
.wd-graph-tab { }
.graph-container { background: #fff; border: 1px solid #e8eaed; border-radius: 12px; overflow: hidden; cursor: grab; }
.graph-container:active { cursor: grabbing; }
.graph-svg { width: 100%; height: auto; display: block; }
.graph-node { fill: #1a73e8; stroke: #fff; stroke-width: 3; cursor: pointer; transition: r 0.2s; }
.graph-node-g:hover .graph-node { r: 24; }
.graph-node-text { fill: #fff; font-size: 10px; font-weight: 600; pointer-events: none; }
.graph-node-label { fill: #5f6368; font-size: 10px; pointer-events: none; }
.graph-edge { stroke: #c4c7cc; stroke-width: 2; fill: none; }
.graph-edge.hov { stroke: #1a73e8; stroke-width: 4; }
.edge-label { fill: #9aa0a6; font-size: 10px; pointer-events: none; }
.edge-label.hov { fill: #1a73e8; font-weight: 500; }

/* ===== MANAGE TAB ===== */
.wd-manage-tab { display: flex; flex-direction: column; gap: 20px; }
.mg-card { background: #fff; border: 1px solid #e8eaed; border-radius: 12px; padding: 20px; }
.mg-card h3 { margin: 0 0 14px 0; font-size: 16px; color: #202124; }
.mg-field { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
.mg-field label { color: #5f6368; }
.mg-field span { color: #202124; font-weight: 500; }
.mg-actions { display: flex; gap: 8px; margin-top: 14px; }
.mg-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f3f4; font-size: 14px; }
.mg-row.clickable { cursor: pointer; border-radius: 4px; }
.mg-row.clickable:hover { background: #f8f9fa; }
.mg-btn-del { padding: 4px 12px; background: #fff; color: #d93025; border: 1px solid #f28b82; border-radius: 4px; cursor: pointer; font-size: 12px; font-family: inherit; }
.mg-btn-del:hover { background: #fce8e6; }
.mg-meta { font-size: 12px; color: #999; }

.mg-change { border: 1px solid #e8eaed; border-radius: 8px; padding: 12px; margin-top: 10px; }
.mg-change-head { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 6px; }
.mg-change-type { padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 500; }
.mg-change-type.type-CREATE { background: #e6f4ea; color: #137333; }
.mg-change-type.type-UPDATE { background: #e8f0fe; color: #1a73e8; }
.mg-change-type.type-DELETE { background: #fce8e6; color: #c5221f; }
.mg-change-time { color: #999; margin-left: auto; font-size: 12px; }
.mg-change-body { font-size: 13px; color: #5f6368; margin-bottom: 8px; }
.mg-change-body strong { color: #333; }
.mg-change-actions { display: flex; gap: 8px; }

/* ===== BUTTONS ===== */
.wd-btn-primary { padding: 10px 24px; background: #1a73e8; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background 0.15s; }
.wd-btn-primary:hover:not(:disabled) { background: #1557b0; }
.wd-btn-primary:disabled { background: #a8c7fa; cursor: not-allowed; }
.wd-btn-primary.sm { padding: 6px 14px; font-size: 13px; }
.wd-btn-secondary { padding: 8px 18px; background: #fff; color: #1a73e8; border: 1px solid #d2e3fc; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: inherit; }
.wd-btn-secondary:hover { background: #e8f0fe; }
.wd-btn-accent { padding: 8px 18px; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: inherit; }
.wd-btn-accent:hover:not(:disabled) { opacity: 0.9; }
.wd-btn-accent:disabled { opacity: 0.5; cursor: not-allowed; }
.wd-btn-danger { padding: 8px 18px; background: #fff; color: #d93025; border: 1px solid #f28b82; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: inherit; }
.wd-btn-danger:hover { background: #fce8e6; }
.wd-btn-danger.sm { padding: 6px 14px; font-size: 13px; }
.btn-danger { padding: 8px 18px; background: #fff; color: #d93025; border: 1px solid #f28b82; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: inherit; }
.btn-new-type { padding: 6px 12px; background: #e8f0fe; color: #1a73e8; border: 1px dashed #1a73e8; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: inherit; }
.new-type-row { display: flex; gap: 6px; align-items: center; margin-top: 6px; }

/* ===== MODALS ===== */
.modal-overlay { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.25); backdrop-filter: blur(6px); padding: 24px; }
.modal-box { background: #fff; border-radius: 16px; padding: 28px 32px; width: 460px; max-width: 90vw; max-height: 85vh; overflow-y: auto; box-shadow: 0 16px 48px rgba(0,0,0,0.15); }
.modal-lg { width: 700px; }
.modal-sm { width: 360px; }
.modal-error { background: #fce8e6; color: #d93025; padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 12px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.modal-header h2 { margin: 0; font-size: 18px; }
.btn-close { background: none; border: none; font-size: 18px; color: #999; cursor: pointer; }
.btn-close:hover { color: #202124; }
.btn-cancel { padding: 10px 22px; background: #fff; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; color: #5f6368; cursor: pointer; font-family: inherit; }
.btn-cancel.sm { padding: 8px 14px; font-size: 13px; }
.form-row { margin-bottom: 14px; }
.form-row label { display: block; font-size: 13px; font-weight: 500; color: #5f6368; margin-bottom: 4px; }
.form-row-inline { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.form-input { width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; box-sizing: border-box; }
.form-input:focus { border-color: #1a73e8; box-shadow: 0 0 0 2px rgba(26,115,232,0.1); }
.form-textarea { resize: vertical; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.modal-actions-right { display: flex; gap: 10px; margin-left: auto; }

/* Relation modals */
.rel-list { display: flex; flex-direction: column; gap: 6px; }
.rel-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #f8fafd; border: 1px solid #e8f0fe; border-radius: 8px; }
.rel-name { font-size: 14px; font-weight: 500; color: #202124; }
.rel-arrow { font-size: 16px; color: #1a73e8; font-weight: 700; }
.rel-desc { font-size: 12px; color: #5f6368; margin-left: auto; }
.rel-row-actions { display: flex; gap: 2px; }

.rel-create { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-bottom: 16px; }
.rel-picker { flex: 1; min-width: 120px; padding: 24px 12px; border: 2px dashed #dadce0; border-radius: 12px; text-align: center; cursor: pointer; transition: all 0.2s; background: #fafafa; }
.rel-picker:hover { border-color: #1a73e8; background: #f0f6ff; }
.rel-picker.selected { border-style: solid; border-color: #1a73e8; background: #e8f0fe; }
.rel-picker-label { font-size: 15px; font-weight: 500; }
.rel-picker-hint { font-size: 12px; color: #999; margin-top: 4px; }
.rel-arrows { display: flex; flex-direction: column; gap: 5px; }
.rel-arrows button { width: 40px; height: 40px; border: 2px solid #dadce0; border-radius: 50%; background: #fff; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; color: #5f6368; }
.rel-arrows button:hover { border-color: #1a73e8; color: #1a73e8; }
.rel-arrows button.active { background: #1a73e8; color: #fff; border-color: #1a73e8; }
.rel-desc-row { flex-basis: 100%; }
.rel-desc-row label { font-size: 12px; color: #5f6368; display: block; margin-bottom: 4px; }

/* Picker panel */
.picker-panel { background: #f8fafd; border: 1px solid #e8f0fe; border-radius: 10px; padding: 14px; margin-top: 12px; }
.picker-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 14px; font-weight: 500; }
.picker-filters { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
.picker-list { display: flex; flex-direction: column; gap: 3px; max-height: 180px; overflow-y: auto; }
.picker-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 14px; }
.picker-item:hover { background: #e8f0fe; }
.picker-type { font-size: 11px; color: #1a73e8; background: rgba(26,115,232,0.08); padding: 1px 6px; border-radius: 8px; }

/* AI modal */
.ai-modal { width: 560px; }
.ai-desc { font-size: 14px; color: #5f6368; margin: 0 0 14px 0; }
.ai-select-entries { display: flex; flex-wrap: wrap; gap: 6px; max-height: 140px; overflow-y: auto; padding: 2px; }
.ai-chip { display: flex; align-items: center; gap: 4px; padding: 5px 10px; background: #f1f3f4; border: 2px solid #e8eaed; border-radius: 14px; cursor: pointer; font-size: 13px; transition: all 0.15s; }
.ai-chip:hover { border-color: #667eea; }
.ai-chip.sel { background: #e8e6ff; border-color: #667eea; color: #5b3e96; }
.ai-chip-type { font-size: 10px; color: #999; }
.ai-result { max-height: 400px; overflow-y: auto; background: #f8f9fa; border-radius: 8px; padding: 14px; font-size: 15px; line-height: 1.8; color: #333; }
.ai-result p { margin: 0 0 10px 0; }

/* ===== ANIMATIONS ===== */
.modal-enter-active { transition: opacity 0.25s; }
.modal-enter-active .modal-box { transition: transform 0.3s, opacity 0.25s; }
.modal-leave-active { transition: opacity 0.2s; }
.modal-leave-active .modal-box { transition: transform 0.2s, opacity 0.15s; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .modal-box { transform: translateY(20px) scale(0.96); opacity: 0; }
.modal-leave-to { opacity: 0; }
.modal-leave-to .modal-box { transform: translateY(10px) scale(0.97); opacity: 0; }
.slide-enter-active { transition: all 0.25s ease; }
.slide-leave-active { transition: all 0.15s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; max-height: 0; }
</style>
