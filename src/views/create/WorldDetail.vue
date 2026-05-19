<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import type { World, WorldEntry, WorldRelation, Result, Collaborator, WorldChange } from '@/types'
import WorldCollaboratorModal from '@/components/WorldCollaboratorModal.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const worldId = Number(route.params.worldId)

const DEFAULT_TYPES = ['人物', '地理', '历史', '物品', '生物', '规则', '故事点', '其他']

// ---- 世界信息 ----
const world = ref<World | null>(null)
const entries = ref<WorldEntry[]>([])
const customTypes = ref<string[]>([])
const selectedType = ref('')
const searchKeyword = ref('')
const message = ref('')

// ---- 共创 ----
const showCollaboratorModal = ref(false)
const collaborators = ref<Collaborator[]>([])
const changes = ref<WorldChange[]>([])
const showChangesPanel = ref(false)

async function loadCollaborators() {
  try {
    const res = await http.get(`/worlds/${worldId}/collaborators`)
    collaborators.value = res.data || []
  } catch { /* */ }
}
async function loadChanges() {
  try {
    const res = await http.get(`/worlds/${worldId}/changes`)
    changes.value = res.data || []
  } catch { /* */ }
}
async function removeCollaborator(userId: number) {
  try {
    await http.delete(`/worlds/${worldId}/collaborators/${userId}`)
    await loadCollaborators()
  } catch (e: any) { alert(e.message || '移除失败') }
}
async function approveChange(changeId: number) {
  try {
    await http.put(`/worlds/${worldId}/changes/${changeId}/approve`)
    await Promise.all([loadChanges(), loadEntries()])
  } catch (e: any) { alert(e.message || '操作失败') }
}
const rejectReason = ref('')
async function rejectChange(changeId: number) {
  try {
    await http.put(`/worlds/${worldId}/changes/${changeId}/reject`, { action: 'REJECT', rejectReason: rejectReason.value })
    rejectReason.value = ''
    await loadChanges()
  } catch (e: any) { alert(e.message || '操作失败') }
}

const changeTypeLabel: Record<string, string> = { CREATE: '新增', UPDATE: '修改', DELETE: '删除' }

// ---- 编辑世界 ----
const isWorldCreator = computed(() => world.value?.userId === userStore.userInfo?.id)
const showEditWorldModal = ref(false)
const editWorldForm = ref({ name: '', description: '', type: '', isPublic: true })
const editWorldMsg = ref('')
const editWorldSaving = ref(false)

function openEditWorld() {
  if (!world.value) return
  editWorldForm.value = {
    name: world.value.name,
    description: world.value.description,
    type: world.value.type,
    isPublic: world.value.isPublic,
  }
  editWorldMsg.value = ''
  showEditWorldModal.value = true
}

async function handleSaveWorld() {
  if (!editWorldForm.value.name.trim()) { editWorldMsg.value = '名称不能为空'; return }
  editWorldSaving.value = true; editWorldMsg.value = ''
  try {
    const res = await http.put(`/worlds/${worldId}`, editWorldForm.value) as unknown as Result<World>
    if (res.code === 200) { world.value = res.data; showEditWorldModal.value = false }
  } catch (e: any) { editWorldMsg.value = e.message || '保存失败' }
  finally { editWorldSaving.value = false }
}

// ---- 设定弹窗 ----
const showEntryModal = ref(false)
const isSubmitting = ref(false)
const entryForm = ref({ name: '', type: '', content: '' })
const showNewEntryTypeInput = ref(false)
const newEntryType = ref('')
const showMoreTypes = ref(false)

const MAX_VISIBLE_TYPES = 8

const allTypes = computed(() => {
  const merged = new Set([...DEFAULT_TYPES, ...customTypes.value])
  return Array.from(merged)
})

const visibleTypes = computed(() => allTypes.value.slice(0, MAX_VISIBLE_TYPES))
const overflowTypes = computed(() => allTypes.value.slice(MAX_VISIBLE_TYPES))

function startNewEntryType() {
  newEntryType.value = ''
  showNewEntryTypeInput.value = true
}

function confirmNewEntryType() {
  const t = newEntryType.value.trim()
  if (t && !allTypes.value.includes(t)) {
    customTypes.value.push(t)
    entryForm.value.type = t
  }
  showNewEntryTypeInput.value = false
}

function cancelNewEntryType() {
  showNewEntryTypeInput.value = false
}

// ---- 关系区 ----
const relations = ref<WorldRelation[]>([])
const showRelationModal = ref(false)
const relationView = ref<'list' | 'create'>('list')

// 创建关系
const pickerFor = ref<'from' | 'to' | null>(null)
const relationForm = ref({
  fromEntryId: null as number | null,
  toEntryId: null as number | null,
  direction: 'LEFT_ARROW' as string,
  description: '',
})
const pickerSearch = ref('')
const pickerType = ref('')
const createMsg = ref('')

// 图谱交互
const graphSvg = ref<SVGSVGElement | null>(null)
const graphPan = ref({ x: 0, y: 0 })
const graphScale = ref(1)
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const hoveredEdge = ref<number | null>(null)

// 编辑关系弹窗
const showEditRelModal = ref(false)
const editingRelation = ref<WorldRelation | null>(null)
const editRelForm = ref({ fromEntryId: null as number | null, toEntryId: null as number | null, direction: 'LEFT_ARROW', description: '' })
const editPickerFor = ref<'from' | 'to' | null>(null)
const editPickerSearch = ref('')
const editPickerType = ref('')
const editRelMsg = ref('')
const editRelSaving = ref(false)

const editFilteredEntries = computed(() => {
  let list = entries.value
  if (editPickerType.value) list = list.filter(e => e.type === editPickerType.value)
  if (editPickerSearch.value) list = list.filter(e => e.name.includes(editPickerSearch.value))
  return list
})

function openEditRelation(rel: WorldRelation) {
  editingRelation.value = rel
  editRelForm.value = {
    fromEntryId: rel.fromEntryId,
    toEntryId: rel.toEntryId,
    direction: rel.direction,
    description: rel.description,
  }
  editPickerFor.value = null
  editPickerSearch.value = ''
  editPickerType.value = ''
  editRelMsg.value = ''
  showEditRelModal.value = true
}

function selectEditEntry(id: number) {
  if (editPickerFor.value === 'from') {
    if (id === editRelForm.value.toEntryId) { editRelMsg.value = '不能选择相同的设定'; return }
    editRelForm.value.fromEntryId = id; editPickerFor.value = null
  } else if (editPickerFor.value === 'to') {
    if (id === editRelForm.value.fromEntryId) { editRelMsg.value = '不能选择相同的设定'; return }
    editRelForm.value.toEntryId = id; editPickerFor.value = null
  }
}

async function handleSaveRelation() {
  if (!editRelForm.value.fromEntryId || !editRelForm.value.toEntryId) {
    editRelMsg.value = '请选择两个设定'; return
  }
  if (!editRelForm.value.description.trim()) {
    editRelMsg.value = '请输入关系描述'; return
  }
  editRelSaving.value = true; editRelMsg.value = ''
  try {
    const res = await http.put(
      `/worlds/${worldId}/relations/${editingRelation.value!.id}`,
      editRelForm.value
    ) as unknown as Result<WorldRelation>
    if (res.code === 200) { showEditRelModal.value = false; loadRelations() }
  } catch (e: any) { editRelMsg.value = e.message || '保存失败' }
  finally { editRelSaving.value = false }
}

// ---- 设定条目 ----
async function loadWorld() {
  try {
    const res = await http.get(`/worlds/${worldId}`) as unknown as Result<World>
    if (res.code === 200) world.value = res.data
  } catch (e: any) { message.value = e.message || '加载失败' }
}

async function loadEntries() {
  try {
    const params = new URLSearchParams()
    if (selectedType.value) params.set('type', selectedType.value)
    if (searchKeyword.value) params.set('search', searchKeyword.value)
    const res = await http.get(`/worlds/${worldId}/entries?${params.toString()}`) as unknown as Result<WorldEntry[]>
    if (res.code === 200) entries.value = res.data
  } catch (e: any) { message.value = e.message || '加载失败' }
}

async function loadTypes() {
  try {
    const res = await http.get(`/worlds/${worldId}/entries/types`) as unknown as Result<string[]>
    if (res.code === 200) customTypes.value = res.data.filter((t: string) => !DEFAULT_TYPES.includes(t))
  } catch { /* ignore */ }
}

function selectTypeFilter(type: string) {
  selectedType.value = selectedType.value === type ? '' : type
  loadEntries()
}

function onSearch() { loadEntries() }

function openEntryModal() {
  entryForm.value = { name: '', type: '', content: '' }
  showNewEntryTypeInput.value = false
  newEntryType.value = ''
  showEntryModal.value = true
}
function closeEntryModal() { if (!isSubmitting.value) showEntryModal.value = false }

async function handleCreateEntry() {
  if (!entryForm.value.name.trim() || !entryForm.value.content.trim()) {
    message.value = '设定名称和内容不能为空'
    return
  }
  if (!entryForm.value.type) {
    message.value = '请选择设定类型'
    return
  }
  isSubmitting.value = true; message.value = ''
  try {
    const res = await http.post(`/worlds/${worldId}/entries`, entryForm.value) as unknown as Result<WorldEntry>
    if (res.code === 200) { showEntryModal.value = false; loadEntries(); loadTypes(); loadRelations() }
  } catch (e: any) { message.value = e.message || '创建失败' }
  finally { isSubmitting.value = false }
}

async function deleteEntry(entryId: number, entryName: string) {
  if (!confirm(`确定要删除设定「${entryName}」吗？此操作不可撤销。`)) return
  try {
    const res = await http.delete(`/worlds/${worldId}/entries/${entryId}`) as unknown as Result
    if (res.code === 200) { loadEntries(); loadTypes(); loadRelations() }
  } catch (e: any) { message.value = e.message || '删除失败' }
}

// ---- 关系 ----
async function loadRelations() {
  try {
    const res = await http.get(`/worlds/${worldId}/relations`) as unknown as Result<WorldRelation[]>
    if (res.code === 200) relations.value = res.data
  } catch { /* ignore */ }
}

function openRelationModal() {
  relationView.value = 'list'
  showRelationModal.value = true
}
function closeRelationModal() { showRelationModal.value = false }

function startCreateRelation() {
  relationForm.value = { fromEntryId: null, toEntryId: null, direction: 'LEFT_ARROW', description: '' }
  pickerSearch.value = ''
  pickerType.value = ''
  createMsg.value = ''
  relationView.value = 'create'
}

function cancelCreate() { relationView.value = 'list' }

const filteredEntries = computed(() => {
  let list = entries.value
  if (pickerType.value) list = list.filter(e => e.type === pickerType.value)
  if (pickerSearch.value) list = list.filter(e => e.name.includes(pickerSearch.value))
  return list
})

function selectEntryForRelation(entryId: number) {
  if (pickerFor.value === 'from') {
    if (entryId === relationForm.value.toEntryId) { createMsg.value = '不能选择相同的设定'; return }
    relationForm.value.fromEntryId = entryId; pickerFor.value = null
  } else if (pickerFor.value === 'to') {
    if (entryId === relationForm.value.fromEntryId) { createMsg.value = '不能选择相同的设定'; return }
    relationForm.value.toEntryId = entryId; pickerFor.value = null
  }
}

function getEntryName(id: number | null) {
  if (!id) return '点击选择'
  return entries.value.find(e => e.id === id)?.name || '未知'
}

async function handleCreateRelation() {
  if (!relationForm.value.fromEntryId || !relationForm.value.toEntryId) {
    createMsg.value = '请选择两个设定'; return
  }
  if (!relationForm.value.description.trim()) {
    createMsg.value = '请输入关系描述'; return
  }
  try {
    const res = await http.post(`/worlds/${worldId}/relations`, relationForm.value) as unknown as Result<WorldRelation>
    if (res.code === 200) {
      relationView.value = 'list'
      loadRelations()
    }
  } catch (e: any) { createMsg.value = e.message || '创建失败' }
}

async function deleteRelation(relationId: number) {
  if (!confirm('确定要删除这条关系吗？')) return
  try {
    const res = await http.delete(`/worlds/${worldId}/relations/${relationId}`) as unknown as Result
    if (res.code === 200) loadRelations()
  } catch (e: any) { message.value = e.message || '删除失败' }
}

async function deleteWorld_confirm() {
  if (!confirm(`确定要删除世界「${world.value?.name}」及其所有设定和关系吗？此操作不可撤销。`)) return
  try {
    const res = await http.delete(`/worlds/${worldId}`) as unknown as Result
    if (res.code === 200) router.push('/create/setting')
  } catch (e: any) { message.value = e.message || '删除失败' }
}

const directionLabel: Record<string, string> = {
  LEFT_ARROW: '←', RIGHT_ARROW: '→', BIDIRECTIONAL: '↔'
}
const directionText: Record<string, string> = {
  LEFT_ARROW: '右是左的...', RIGHT_ARROW: '左是右的...', BIDIRECTIONAL: '彼此是...'
}

// ---- 图谱布局 ----
const graphNodes = computed(() => {
  const entrySet = new Set<number>()
  relations.value.forEach(r => { entrySet.add(r.fromEntryId); entrySet.add(r.toEntryId) })
  const nodes = Array.from(entrySet).map(id => {
    const e = entries.value.find(x => x.id === id)
    return { id, name: e?.name || '未知' }
  })
  // 圆周布局
  const count = nodes.length
  const radius = Math.max(120, count * 22)
  const cx = 230, cy = 260
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    n.x = cx + radius * Math.cos(angle)
    n.y = cy + radius * Math.sin(angle)
  })
  return nodes
})

const graphEdges = computed(() => {
  return relations.value.map(r => ({
    id: r.id,
    fromId: r.fromEntryId,
    toId: r.toEntryId,
    direction: r.direction,
    description: r.description,
    label: r.description,
  }))
})

const nodeMap = computed(() => {
  const m: Record<number, { x: number; y: number }> = {}
  graphNodes.value.forEach(n => { m[n.id] = { x: n.x, y: n.y } })
  return m
})

function edgePath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x; const dy = to.y - from.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const r = 22
  const sx = from.x + (dx / dist) * r; const sy = from.y + (dy / dist) * r
  const ex = to.x - (dx / dist) * r; const ey = to.y - (dy / dist) * r
  return `M${sx},${sy} L${ex},${ey}`
}

function edgeMid(from: { x: number; y: number }, to: { x: number; y: number }) {
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
}

// 图谱交互
function onGraphMouseDown(e: MouseEvent) {
  if (e.target === graphSvg.value || (e.target as SVGElement).classList.contains('graph-bg')) {
    dragging.value = true
    dragStart.value = { x: e.clientX - graphPan.value.x, y: e.clientY - graphPan.value.y }
  }
}
function onGraphMouseMove(e: MouseEvent) {
  if (!dragging.value) return
  graphPan.value = { x: e.clientX - dragStart.value.x, y: e.clientY - dragStart.value.y }
}
function onGraphMouseUp() { dragging.value = false }
function onGraphWheel(e: WheelEvent) {
  e.preventDefault()
  graphScale.value = Math.max(0.3, Math.min(2, graphScale.value - e.deltaY * 0.001))
}

// ---- 生命周期 ----
onMounted(() => {
  loadWorld(); loadEntries(); loadTypes(); loadRelations()
  loadCollaborators(); loadChanges()
})
</script>

<template>
  <div class="wd-page">
    <!-- 顶部世界信息 -->
    <div class="wd-header">
      <button class="back-btn" @click="router.push('/create/setting')">← 返回</button>
      <div class="wd-info">
        <h1 class="wd-name">
          {{ world?.name || '加载中...' }}
<!--          <span v-if="world && !world.isPublic" class="private-badge">🔒 私有</span>-->
        </h1>
        <div class="wd-meta">
          <span v-if="world?.type" class="wd-type-tag">{{ world.type }}</span>
          <span class="wd-desc">{{ world?.description || '暂无简介' }}</span>
          <button v-if="isWorldCreator" class="btn-edit-world" @click="openEditWorld">⚙️ 编辑世界</button>
          <button v-if="isWorldCreator" class="btn-delete-world" @click="deleteWorld_confirm">🗑 删除世界</button>
          <button v-if="isWorldCreator" class="btn-manage-collab" @click="showCollaboratorModal = true">👥 共创者 ({{ collaborators.length }})</button>
          <button
            v-if="isWorldCreator && changes.length > 0"
            class="btn-pending-changes"
            @click="showChangesPanel = !showChangesPanel"
          >
            📋 待审批 ({{ changes.filter(c => c.status === 'PENDING').length }})
          </button>
        </div>
      </div>
    </div>

    <!-- 共创者管理 -->
    <div v-if="isWorldCreator" class="collab-section">
      <h3>共创者</h3>
      <div v-if="collaborators.length === 0" class="empty-hint">暂无共创者</div>
      <div v-for="c in collaborators" :key="c.userId" class="collab-row">
        <span>{{ c.username || '用户' + c.userId }}</span>
        <button class="btn-remove-collab" @click="removeCollaborator(c.userId)">移除</button>
      </div>
    </div>

    <!-- 待审批修改 -->
    <div v-if="isWorldCreator && showChangesPanel" class="changes-section">
      <h3>待审批修改</h3>
      <div v-if="changes.filter(c => c.status === 'PENDING').length === 0" class="empty-hint">暂无待审批修改</div>
      <div v-for="c in changes.filter(c => c.status === 'PENDING')" :key="c.id" class="change-card">
        <div class="change-header">
          <span class="change-type" :class="'change-' + c.changeType">{{ changeTypeLabel[c.changeType] || c.changeType }}</span>
          <span class="change-user">{{ c.username }}</span>
          <span class="change-time">{{ new Date(c.createdAt).toLocaleString() }}</span>
        </div>
        <div class="change-body">
          <strong>{{ c.entryName }}</strong>
          <p>{{ c.entryContent?.substring(0, 200) }}{{ c.entryContent?.length > 200 ? '...' : '' }}</p>
        </div>
        <div class="change-actions">
          <button class="btn-approve" @click="approveChange(c.id)">✓ 同意</button>
          <div class="reject-row">
            <input v-model="rejectReason" class="reject-input" placeholder="拒绝理由（可选）" />
            <button class="btn-reject" @click="rejectChange(c.id)">✗ 拒绝</button>
          </div>
        </div>
      </div>
    </div>

    <WorldCollaboratorModal
      :show="showCollaboratorModal"
      :world-id="worldId"
      :existing-collaborators="collaborators"
      @close="showCollaboratorModal = false"
      @added="loadCollaborators"
    />

    <!-- 编辑世界弹窗 -->
    <transition name="modal">
      <div v-if="showEditWorldModal" class="modal-overlay" @click.self="showEditWorldModal = false">
        <div class="modal-box">
          <h2 class="modal-title">编辑世界</h2>
          <div v-if="editWorldMsg" class="modal-error">{{ editWorldMsg }}</div>
          <div class="form-row"><label class="form-label">名称</label><input v-model="editWorldForm.name" type="text" class="form-input" /></div>
          <div class="form-row"><label class="form-label">类型</label><input v-model="editWorldForm.type" type="text" class="form-input" placeholder="如：奇幻、科幻..." /></div>
          <div class="form-row"><label class="form-label">简介</label><textarea v-model="editWorldForm.description" class="form-input form-textarea" rows="3"></textarea></div>
          <div class="form-row form-row-inline" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
            <label class="form-label" style="margin:0">公开世界</label>
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
              <ToggleSwitch v-model="editWorldForm.isPublic" />
              <span style="font-size:13px;color:#5f6368">{{ editWorldForm.isPublic ? '所有人可见' : '仅自己可见' }}</span>
            </label>
          </div>
          <div class="modal-actions">
            <button class="btn-cancel" @click="showEditWorldModal = false">取消</button>
            <button class="btn-create" @click="handleSaveWorld" :disabled="editWorldSaving">
              {{ editWorldSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 双栏 -->
    <div class="wd-columns">
      <!-- 左侧：设定区 -->
      <div class="wd-left">
        <div class="panel-header">
          <h2>设定区</h2>
          <button class="btn-add-entry" @click="openEntryModal">+ 添加设定</button>
        </div>
        <div class="filter-row">
          <span class="filter-label">类型</span>
          <div class="type-chips">
            <button v-for="t in visibleTypes" :key="t" class="type-chip" :class="{ active: selectedType === t }" @click="selectTypeFilter(t)">{{ t }}</button>
            <button
              v-if="overflowTypes.length > 0"
              class="type-chip type-chip-more"
              @click="showMoreTypes = true"
            >
              更多 ({{ overflowTypes.length }})
            </button>
            <button class="type-chip type-chip-add" @click="startNewEntryType(); showMoreTypes = false">+ 添加类型</button>
          </div>
          <div class="search-box">
            <input v-model="searchKeyword" type="text" class="search-input" placeholder="搜索..." @keyup.enter="onSearch" />
          </div>
        </div>

        <!-- More types modal -->
        <transition name="modal">
          <div v-if="showMoreTypes" class="modal-overlay" @click.self="showMoreTypes = false">
            <div class="modal-box modal-sm">
              <h3 class="modal-title">所有类型</h3>
              <div class="type-chips type-chips-grid">
                <button
                  v-for="t in allTypes"
                  :key="t"
                  class="type-chip"
                  :class="{ active: selectedType === t }"
                  @click="selectTypeFilter(t); showMoreTypes = false"
                >{{ t }}</button>
              </div>
              <div class="modal-actions">
                <button class="btn-cancel" @click="showMoreTypes = false">关闭</button>
              </div>
            </div>
          </div>
        </transition>
        <div v-if="entries.length === 0" class="empty-hint">暂无设定条目</div>
        <div class="entry-list">
          <div v-for="e in entries" :key="e.id" class="entry-row" @click="router.push(`/create/setting/${worldId}/entry/${e.id}`)">
            <div class="entry-head">
              <span class="entry-name">{{ e.name }}</span>
              <span v-if="e.type" class="entry-type-tag">{{ e.type }}</span>
              <button v-if="isWorldCreator" class="btn-delete-sm" @click.stop="deleteEntry(e.id, e.name)" title="删除此设定">✕</button>
            </div>
            <div class="entry-preview">{{ e.contentPreview || e.content }}</div>
          </div>
        </div>
      </div>

      <!-- 右侧：关系区 -->
      <div class="wd-right">
        <div class="panel-header">
          <h2>关系区</h2>
          <button class="btn-add-rel" @click="openRelationModal">+ 添加关系</button>
        </div>
        <div v-if="relations.length === 0" class="placeholder-box">
          <p>暂无关系，点击上方按钮添加</p>
        </div>
        <!-- 关系图谱 SVG -->
        <div v-else class="graph-container" ref="graphContainer">
          <svg
            ref="graphSvg"
            class="graph-svg"
            viewBox="0 0 460 520"
            @mousedown="onGraphMouseDown"
            @mousemove="onGraphMouseMove"
            @mouseup="onGraphMouseUp"
            @mouseleave="onGraphMouseUp"
            @wheel="onGraphWheel"
          >
            <!-- 背景（用于拖拽） -->
            <rect class="graph-bg" x="0" y="0" width="460" height="520" fill="transparent" />
            <g :transform="`translate(${graphPan.x},${graphPan.y}) scale(${graphScale})`">
              <!-- 连线 -->
              <g v-for="edge in graphEdges" :key="'e'+edge.id" style="cursor:pointer" @click.stop="openEditRelation(relations.find(r => r.id === edge.id)!)">
                <line
                  v-if="nodeMap[edge.fromId] && nodeMap[edge.toId]"
                  :x1="nodeMap[edge.fromId].x" :y1="nodeMap[edge.fromId].y"
                  :x2="nodeMap[edge.toId].x" :y2="nodeMap[edge.toId].y"
                  class="graph-edge"
                  :class="{
                    'edge-hovered': hoveredEdge === edge.id,
                    'edge-left': edge.direction === 'LEFT_ARROW',
                    'edge-right': edge.direction === 'RIGHT_ARROW',
                    'edge-bi': edge.direction === 'BIDIRECTIONAL',
                  }"
                  @mouseenter="hoveredEdge = edge.id"
                  @mouseleave="hoveredEdge = null"
                />
                <!-- 箭头标记 -->
                <polygon
                  v-if="nodeMap[edge.fromId] && nodeMap[edge.toId] && edge.direction !== 'BIDIRECTIONAL'"
                  :points="(() => {
                    const f = nodeMap[edge.fromId]; const t = nodeMap[edge.toId]
                    const dx = t.x - f.x; const dy = t.y - f.y
                    const dist = Math.sqrt(dx*dx+dy*dy); const r = 22
                    const tipX = edge.direction === 'LEFT_ARROW' ? f.x + (dx/dist)*r : t.x - (dx/dist)*r
                    const tipY = edge.direction === 'LEFT_ARROW' ? f.y + (dy/dist)*r : t.y - (dy/dist)*r
                    const aSize = 8
                    const angle = Math.atan2(dy, dx)
                    const p1x = tipX - aSize * Math.cos(angle - 0.5); const p1y = tipY - aSize * Math.sin(angle - 0.5)
                    const p2x = tipX - aSize * Math.cos(angle + 0.5); const p2y = tipY - aSize * Math.sin(angle + 0.5)
                    return `${tipX},${tipY} ${p1x},${p1y} ${p2x},${p2y}`
                  })()"
                  class="graph-arrow"
                  :class="{ 'arrow-hovered': hoveredEdge === edge.id }"
                  @mouseenter="hoveredEdge = edge.id"
                  @mouseleave="hoveredEdge = null"
                />
                <!-- 双向：两端箭头 -->
                <template v-if="nodeMap[edge.fromId] && nodeMap[edge.toId] && edge.direction === 'BIDIRECTIONAL'">
                  <polygon
                    :points="(() => {
                      const f = nodeMap[edge.fromId]; const t = nodeMap[edge.toId]
                      const dx = t.x - f.x; const dy = t.y - f.y
                      const dist = Math.sqrt(dx*dx+dy*dy); const r = 22
                      const tipX = f.x + (dx/dist)*r; const tipY = f.y + (dy/dist)*r
                      const aSize = 8; const angle = Math.atan2(dy, dx)
                      const p1x = tipX - aSize * Math.cos(angle - 0.5); const p1y = tipY - aSize * Math.sin(angle - 0.5)
                      const p2x = tipX - aSize * Math.cos(angle + 0.5); const p2y = tipY - aSize * Math.sin(angle + 0.5)
                      return `${tipX},${tipY} ${p1x},${p1y} ${p2x},${p2y}`
                    })()"
                    class="graph-arrow" :class="{ 'arrow-hovered': hoveredEdge === edge.id }"
                    @mouseenter="hoveredEdge = edge.id" @mouseleave="hoveredEdge = null"
                  />
                  <polygon
                    :points="(() => {
                      const f = nodeMap[edge.fromId]; const t = nodeMap[edge.toId]
                      const dx = f.x - t.x; const dy = f.y - t.y
                      const dist = Math.sqrt(dx*dx+dy*dy); const r = 22
                      const tipX = t.x + (dx/dist)*r; const tipY = t.y + (dy/dist)*r
                      const aSize = 8; const angle = Math.atan2(dy, dx)
                      const p1x = tipX - aSize * Math.cos(angle - 0.5); const p1y = tipY - aSize * Math.sin(angle - 0.5)
                      const p2x = tipX - aSize * Math.cos(angle + 0.5); const p2y = tipY - aSize * Math.sin(angle + 0.5)
                      return `${tipX},${tipY} ${p1x},${p1y} ${p2x},${p2y}`
                    })()"
                    class="graph-arrow" :class="{ 'arrow-hovered': hoveredEdge === edge.id }"
                    @mouseenter="hoveredEdge = edge.id" @mouseleave="hoveredEdge = null"
                  />
                </template>
                <!-- 关系标签 -->
                <text
                  v-if="nodeMap[edge.fromId] && nodeMap[edge.toId]"
                  :x="edgeMid(nodeMap[edge.fromId], nodeMap[edge.toId]).x"
                  :y="edgeMid(nodeMap[edge.fromId], nodeMap[edge.toId]).y - 8"
                  class="edge-label"
                  :class="{ 'edge-label-hovered': hoveredEdge === edge.id }"
                  text-anchor="middle"
                  @mouseenter="hoveredEdge = edge.id"
                  @mouseleave="hoveredEdge = null"
                >{{ edge.description }}</text>
              </g>
              <!-- 节点 -->
              <g v-for="node in graphNodes" :key="'n'+node.id" class="graph-node-group"
                 @click="router.push(`/create/setting/${worldId}/entry/${node.id}`)">
                <circle :cx="node.x" :cy="node.y" r="20" class="graph-node" />
                <text :x="node.x" :y="node.y + 4" class="graph-node-text" text-anchor="middle">{{ node.name.length > 3 ? node.name.slice(0,3)+'..' : node.name }}</text>
                <text :x="node.x" :y="node.y + 34" class="graph-node-label" text-anchor="middle">{{ node.name }}</text>
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>

    <!-- 关系弹窗（大） -->
    <transition name="modal">
      <div v-if="showRelationModal" class="modal-overlay" @click.self="closeRelationModal">
        <div class="modal-box modal-large" @click.stop>
          <!-- 列表视图 -->
          <template v-if="relationView === 'list'">
            <div class="rel-modal-header">
              <h2>设定关系</h2>
              <button class="btn-close-icon" @click="closeRelationModal">✕</button>
            </div>
            <div v-if="relations.length === 0" class="rel-empty">暂无关系</div>
            <div class="rel-list">
              <div v-for="r in relations" :key="r.id" class="rel-row">
                <span class="rel-entry-name">{{ r.fromEntryName }}</span>
                <span class="rel-arrow">{{ directionLabel[r.direction] }}</span>
                <span class="rel-entry-name">{{ r.toEntryName }}</span>
                <span class="rel-desc-text">{{ r.description }}</span>
                <button v-if="isWorldCreator" class="btn-delete-sm" @click="deleteRelation(r.id)" title="删除此关系">✕</button>
              </div>
            </div>
            <div class="rel-actions">
              <button class="btn-primary" @click="startCreateRelation">+ 添加关系</button>
            </div>
          </template>

          <!-- 创建视图 -->
          <template v-if="relationView === 'create'">
            <div class="rel-modal-header">
              <h2>新建关系</h2>
              <button class="btn-close-icon" @click="closeRelationModal">✕</button>
            </div>
            <div v-if="createMsg" class="modal-error">{{ createMsg }}</div>

            <!-- 选择器 -->
            <div class="rel-create-body">
              <!-- 左侧设定块 -->
              <div class="rel-picker" :class="{ 'rel-picker-selected': relationForm.fromEntryId }" @click="pickerFor = 'from'">
                <div class="rel-picker-label">{{ getEntryName(relationForm.fromEntryId) }}</div>
                <div class="rel-picker-hint">点击选择设定</div>
              </div>

              <!-- 中间箭头选择 -->
              <div class="rel-arrow-selector">
                <button class="arrow-opt" :class="{ active: relationForm.direction === 'LEFT_ARROW' }" @click="relationForm.direction = 'LEFT_ARROW'" title="左箭头：右边是左边的...">←</button>
                <button class="arrow-opt" :class="{ active: relationForm.direction === 'BIDIRECTIONAL' }" @click="relationForm.direction = 'BIDIRECTIONAL'" title="双向箭头：彼此...">↔</button>
                <button class="arrow-opt" :class="{ active: relationForm.direction === 'RIGHT_ARROW' }" @click="relationForm.direction = 'RIGHT_ARROW'" title="右箭头：左边是右边的...">→</button>
              </div>

              <!-- 右侧设定块 -->
              <div class="rel-picker" :class="{ 'rel-picker-selected': relationForm.toEntryId }" @click="pickerFor = 'to'">
                <div class="rel-picker-label">{{ getEntryName(relationForm.toEntryId) }}</div>
                <div class="rel-picker-hint">点击选择设定</div>
              </div>

              <!-- 关系输入 -->
              <div class="rel-desc-input">
                <label class="form-label-sm">{{ directionText[relationForm.direction] }}</label>
                <input v-model="relationForm.description" type="text" class="form-input" placeholder="输入关系描述..." />
              </div>
            </div>

            <!-- 设定选择面板 -->
            <transition name="slide">
              <div v-if="pickerFor" class="picker-panel">
                <div class="picker-panel-header">
                  <span>选择设定</span>
                  <button class="btn-close-icon small" @click="pickerFor = null">✕</button>
                </div>
                <div class="picker-panel-body">
                  <div class="picker-filters">
                    <div class="type-chips small">
                      <button v-for="t in allTypes" :key="t" class="type-chip" :class="{ active: pickerType === t }" @click="pickerType = pickerType === t ? '' : t">{{ t }}</button>
                    </div>
                    <input v-model="pickerSearch" type="text" class="search-input" placeholder="搜索..." />
                  </div>
                  <div class="picker-list">
                    <div v-for="e in filteredEntries" :key="e.id" class="picker-item" @click="selectEntryForRelation(e.id)">
                      <span class="picker-item-name">{{ e.name }}</span>
                      <span v-if="e.type" class="picker-item-type">{{ e.type }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </transition>

            <div class="rel-actions">
              <button class="btn-cancel" @click="cancelCreate">返回列表</button>
              <button class="btn-primary" @click="handleCreateRelation">确认</button>
            </div>
          </template>
        </div>
      </div>
    </transition>

    <!-- 设定弹窗（小） -->
    <transition name="modal">
      <div v-if="showEntryModal" class="modal-overlay" @click.self="closeEntryModal">
        <div class="modal-box">
          <h2 class="modal-title">添加设定</h2>
          <div v-if="message" class="modal-error">{{ message }}</div>
          <div class="form-row"><label class="form-label">设定名称</label><input v-model="entryForm.name" type="text" class="form-input" placeholder="如：主角小明" /></div>
          <div class="form-row">
            <label class="form-label">类型</label>
            <div class="type-select-row">
              <select v-model="entryForm.type" class="form-input form-select-type">
                <option value="" disabled>选择设定类型</option>
                <option v-for="t in allTypes" :key="t" :value="t">{{ t }}</option>
              </select>
              <button v-if="!showNewEntryTypeInput" type="button" class="btn-new-type" @click="startNewEntryType">+ 添加类型</button>
            </div>
            <div v-if="showNewEntryTypeInput" class="new-type-row">
              <input
                v-model="newEntryType"
                type="text"
                class="form-input form-input-new-type"
                placeholder="输入新类型名称"
                @keyup.enter="confirmNewEntryType"
              />
              <button type="button" class="btn-confirm-type" @click="confirmNewEntryType">确定</button>
              <button type="button" class="btn-cancel-type" @click="cancelNewEntryType">取消</button>
            </div>
          </div>
          <div class="form-row"><label class="form-label">内容</label><textarea v-model="entryForm.content" class="form-input form-textarea" rows="8" placeholder="详细描述这个设定..."></textarea></div>
          <div class="modal-actions">
            <button class="btn-cancel" @click="closeEntryModal" :disabled="isSubmitting">取消</button>
            <button class="btn-create" @click="handleCreateEntry" :disabled="isSubmitting">{{ isSubmitting ? '创建中...' : '创建！' }}</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 编辑关系弹窗 -->
    <transition name="modal">
      <div v-if="showEditRelModal" class="modal-overlay" @click.self="showEditRelModal = false">
        <div class="modal-box modal-large" @click.stop>
          <div class="rel-modal-header">
            <h2>编辑关系</h2>
            <button class="btn-close-icon" @click="showEditRelModal = false">✕</button>
          </div>
          <div v-if="editRelMsg" class="modal-error">{{ editRelMsg }}</div>

          <div class="rel-create-body">
            <!-- 左侧设定块 -->
            <div class="rel-picker" :class="{ 'rel-picker-selected': editRelForm.fromEntryId }" @click="editPickerFor = 'from'">
              <div class="rel-picker-label">{{ getEntryName(editRelForm.fromEntryId) }}</div>
              <div class="rel-picker-hint">点击更换设定</div>
            </div>

            <!-- 箭头选择 -->
            <div class="rel-arrow-selector">
              <button class="arrow-opt" :class="{ active: editRelForm.direction === 'LEFT_ARROW' }" @click="editRelForm.direction = 'LEFT_ARROW'">←</button>
              <button class="arrow-opt" :class="{ active: editRelForm.direction === 'BIDIRECTIONAL' }" @click="editRelForm.direction = 'BIDIRECTIONAL'">↔</button>
              <button class="arrow-opt" :class="{ active: editRelForm.direction === 'RIGHT_ARROW' }" @click="editRelForm.direction = 'RIGHT_ARROW'">→</button>
            </div>

            <!-- 右侧设定块 -->
            <div class="rel-picker" :class="{ 'rel-picker-selected': editRelForm.toEntryId }" @click="editPickerFor = 'to'">
              <div class="rel-picker-label">{{ getEntryName(editRelForm.toEntryId) }}</div>
              <div class="rel-picker-hint">点击更换设定</div>
            </div>

            <!-- 关系描述 -->
            <div class="rel-desc-input">
              <label class="form-label-sm">{{ directionText[editRelForm.direction] }}</label>
              <input v-model="editRelForm.description" type="text" class="form-input" placeholder="输入关系描述..." />
            </div>
          </div>

          <!-- 设定选择面板 -->
          <transition name="slide">
            <div v-if="editPickerFor" class="picker-panel">
              <div class="picker-panel-header">
                <span>选择设定</span>
                <button class="btn-close-icon small" @click="editPickerFor = null">✕</button>
              </div>
              <div class="picker-panel-body">
                <div class="picker-filters">
                  <div class="type-chips small">
                    <button v-for="t in allTypes" :key="t" class="type-chip" :class="{ active: editPickerType === t }" @click="editPickerType = editPickerType === t ? '' : t">{{ t }}</button>
                  </div>
                  <input v-model="editPickerSearch" type="text" class="search-input" placeholder="搜索..." />
                </div>
                <div class="picker-list">
                  <div v-for="e in editFilteredEntries" :key="e.id" class="picker-item" @click="selectEditEntry(e.id)">
                    <span class="picker-item-name">{{ e.name }}</span>
                    <span v-if="e.type" class="picker-item-type">{{ e.type }}</span>
                  </div>
                </div>
              </div>
            </div>
          </transition>

          <div class="rel-actions">
            <button v-if="isWorldCreator" class="btn-delete" @click="deleteRelation(editingRelation!.id); showEditRelModal = false">删除关系</button>
            <div class="rel-actions-right">
              <button class="btn-cancel" @click="showEditRelModal = false">取消</button>
              <button class="btn-primary" @click="handleSaveRelation" :disabled="editRelSaving">
                {{ editRelSaving ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.wd-page { max-width: 1100px; margin: 0 auto; padding: 32px 20px; }

/* 顶部 */
.wd-header { margin-bottom: 24px; }
.back-btn { background: none; border: none; color: #1a73e8; cursor: pointer; font-size: 14px; padding: 0; margin-bottom: 10px; }
.back-btn:hover { text-decoration: underline; }
.wd-name { font-size: 26px; font-weight: 600; color: #202124; margin-bottom: 6px; }
.wd-meta { display: flex; align-items: center; gap: 10px; }
.wd-type-tag { font-size: 12px; background: rgba(26,115,232,0.1); color: #1a73e8; padding: 2px 10px; border-radius: 20px; }
.wd-desc { font-size: 14px; color: #5f6368; }
.btn-edit-world {
  margin-left: auto; padding: 6px 14px; border: 1px solid #dadce0; background: #fff;
  color: #5f6368; border-radius: 6px; font-size: 13px; cursor: pointer; transition: all 0.15s;
  white-space: nowrap;
}
.btn-edit-world:hover { border-color: #1a73e8; color: #1a73e8; }
.btn-delete-world {
  padding: 6px 14px; border: 1px solid #f5c6cb; background: #fff;
  color: #d93025; border-radius: 6px; font-size: 13px; cursor: pointer; transition: all 0.15s;
  white-space: nowrap;
}
.btn-delete-world:hover { background: #fce8e6; border-color: #d93025; }
.btn-delete-sm {
  margin-left: auto; background: none; border: none; color: #9aa0a6; font-size: 14px; cursor: pointer;
  padding: 2px 6px; border-radius: 4px; flex-shrink: 0;
}
.btn-delete-sm:hover { color: #d93025; background: #fce8e6; }
.btn-delete {
  padding: 10px 24px; border: 1px solid #f5c6cb; background: #fff;
  color: #d93025; border-radius: 8px; font-size: 14px; cursor: pointer; transition: all 0.15s;
}
.btn-delete:hover { background: #fce8e6; }
.private-badge { font-size: 12px; font-weight: 400; color: #5f6368; background: #f1f3f4; padding: 2px 10px; border-radius: 10px; margin-left: 8px; }
.form-row-inline { display: flex; align-items: center; justify-content: space-between; }
.toggle-switch { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.toggle-switch input { display: none; }
.toggle-slider { width: 40px; height: 22px; background: #dadce0; border-radius: 11px; position: relative; transition: background 0.2s; flex-shrink: 0; }
.toggle-slider::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: transform 0.2s; }
.toggle-switch input:checked + .toggle-slider { background: #1a73e8; }
.toggle-switch input:checked + .toggle-slider::after { transform: translateX(18px); }
.toggle-text { font-size: 13px; color: #5f6368; }

/* 双栏 */
.wd-columns { display: grid; grid-template-columns: 1fr 480px; gap: 24px; align-items: start; }

/* 面板通用 */
.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.panel-header h2 { font-size: 18px; font-weight: 600; color: #202124; margin: 0; }

/* 按钮 */
.btn-add-entry, .btn-add-rel {
  padding: 8px 20px; border: 2px dashed #a8c7fa; background: #f0f6ff;
  color: #1a73e8; border-radius: 8px; font-size: 13px; cursor: pointer; transition: all 0.2s ease;
}
.btn-add-entry:hover, .btn-add-rel:hover { background: #e3efff; border-color: #1a73e8; }
.btn-primary {
  padding: 10px 28px; border: none; background: #1a73e8; color: #fff;
  border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.15s ease;
}
.btn-primary:hover { background: #1557b0; }

/* 筛选行 */
.filter-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.filter-label { font-size: 13px; font-weight: 500; color: #5f6368; }
.type-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.type-chips.small { gap: 4px; }
.type-chip {
  padding: 4px 12px; border: 1px solid #dadce0; background: #fff;
  color: #5f6368; border-radius: 16px; font-size: 12px; cursor: pointer; transition: all 0.15s ease;
}
.type-chip:hover { border-color: #1a73e8; color: #1a73e8; }
.type-chip.active { background: #1a73e8; color: #fff; border-color: #1a73e8; }
.type-chip-more { color: #1a73e8; font-weight: 500; }
.type-chip-add { color: #1a73e8; border-style: dashed; }
.type-chip-add:hover { background: #e8f0fe; border-color: #1a73e8; }
.search-box { margin-left: auto; }

/* Type chips grid in modal */
.type-chips-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.modal-sm { width: 380px; }

/* Type select row (for entry modal) */
.type-select-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.form-select-type { flex: 1; }
.btn-new-type {
  padding: 8px 14px;
  background: #e8f0fe;
  color: #1a73e8;
  border: 1px dashed #1a73e8;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.btn-new-type:hover { background: #d2e3fc; }
.new-type-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
}
.form-input-new-type { flex: 1; }
.btn-confirm-type {
  padding: 8px 14px;
  background: #1a73e8;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}
.btn-confirm-type:hover { background: #1557b0; }
.btn-cancel-type {
  padding: 8px 14px;
  background: #fff;
  color: #5f6368;
  border: 1px solid #dadce0;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}
.btn-cancel-type:hover { background: #f8f9fa; }
.search-input { padding: 6px 12px; border: 1px solid #dadce0; border-radius: 16px; font-size: 13px; outline: none; width: 140px; font-family: inherit; }
.search-input:focus { border-color: #1a73e8; }

/* 条目列表 */
.empty-hint { text-align: center; color: #9aa0a6; font-size: 14px; padding: 32px 0; }
.entry-list { display: flex; flex-direction: column; gap: 8px; }
.entry-row {
  background: #fff; border: 1px solid #e8f0fe; border-radius: 10px;
  padding: 14px 18px; cursor: pointer; transition: all 0.15s ease;
}
.entry-row:hover { border-color: #1a73e8; box-shadow: 0 2px 8px rgba(26,115,232,0.06); }
.entry-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.entry-name { font-size: 15px; font-weight: 500; color: #202124; }
.entry-type-tag { font-size: 11px; background: #e8f0fe; color: #1a73e8; padding: 1px 8px; border-radius: 10px; }
.entry-preview { font-size: 13px; color: #5f6368; line-height: 1.5; }

/* 右侧关系区 */
.wd-right { position: sticky; top: 80px; }
.placeholder-box {
  background: #fff; border: 1px solid #e8f0fe; border-radius: 12px;
  padding: 50px 20px; text-align: center;
}
.placeholder-box p { color: #9aa0a6; font-size: 14px; margin: 0; }

/* 图谱容器 */
.graph-container {
  background: #fff; border: 1px solid #e8f0fe; border-radius: 12px;
  overflow: hidden; cursor: grab;
}
.graph-container:active { cursor: grabbing; }
.graph-svg { width: 100%; height: auto; display: block; }

.graph-node {
  fill: #1a73e8; stroke: #fff; stroke-width: 3;
  transition: fill 0.2s ease, r 0.2s ease; cursor: pointer;
}
.graph-node-group:hover .graph-node { fill: #1557b0; r: 24; }
.graph-node-text {
  fill: #fff; font-size: 11px; font-weight: 600;
  pointer-events: none; dominant-baseline: central;
}
.graph-node-label {
  fill: #5f6368; font-size: 11px; pointer-events: none;
}

.graph-edge { stroke: #c4c7cc; stroke-width: 2; fill: none; transition: stroke 0.2s ease, stroke-width 0.2s ease; pointer-events: stroke; }
.graph-edge.edge-hovered { stroke: #1a73e8; stroke-width: 4; }
.graph-arrow { fill: #c4c7cc; transition: fill 0.2s ease; }
.graph-arrow.arrow-hovered { fill: #1a73e8; }
.edge-label { fill: #9aa0a6; font-size: 10px; transition: fill 0.2s ease; pointer-events: none; }
.edge-label-hovered { fill: #1a73e8; font-size: 11px; font-weight: 500; }

/* 弹窗通用 */
.modal-overlay {
  position: fixed; inset: 0; z-index: 2000;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.25); backdrop-filter: blur(6px);
}
.modal-box {
  background: #fff; border-radius: 16px; padding: 30px 34px;
  width: 460px; max-width: 90vw; box-shadow: 0 16px 48px rgba(0,0,0,0.15);
  max-height: 85vh; overflow-y: auto;
}
.modal-large { width: 720px; }
.modal-title { font-size: 20px; font-weight: 600; color: #202124; margin-bottom: 22px; }
.modal-error { background: #fce8e6; color: #d93025; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
.form-row { margin-bottom: 16px; }
.form-label { display: block; font-size: 14px; font-weight: 500; color: #202124; margin-bottom: 6px; }
.form-label-sm { display: block; font-size: 13px; color: #5f6368; margin-bottom: 6px; }
.form-input {
  width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 8px;
  font-size: 14px; outline: none; box-sizing: border-box; font-family: inherit;
}
.form-input:focus { border-color: #1a73e8; box-shadow: 0 0 0 2px rgba(26,115,232,0.1); }
.form-textarea { resize: vertical; }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 22px; }
.btn-cancel {
  padding: 10px 24px; border: 1px solid #dadce0; background: #fff;
  color: #5f6368; border-radius: 8px; font-size: 14px; cursor: pointer;
}
.btn-cancel:hover { background: #f8f9fa; }
.btn-create {
  padding: 10px 28px; border: none; background: #1a73e8; color: #fff;
  border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;
}
.btn-create:hover:not(:disabled) { background: #1557b0; }
.btn-create:disabled { background: #a8c7fa; cursor: not-allowed; }
.btn-close-icon { background: none; border: none; font-size: 20px; color: #9aa0a6; cursor: pointer; padding: 0; line-height: 1; }
.btn-close-icon:hover { color: #202124; }
.btn-close-icon.small { font-size: 16px; }

/* 关系弹窗 */
.rel-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.rel-modal-header h2 { font-size: 20px; font-weight: 600; color: #202124; margin: 0; }
.rel-empty { text-align: center; color: #9aa0a6; padding: 32px 0; font-size: 14px; }
.rel-list { display: flex; flex-direction: column; gap: 6px; }
.rel-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; background: #f8fafd; border: 1px solid #e8f0fe; border-radius: 10px;
}
.rel-entry-name { font-size: 14px; font-weight: 500; color: #202124; }
.rel-arrow { font-size: 20px; color: #1a73e8; font-weight: 600; }
.rel-desc-text { font-size: 12px; color: #5f6368; margin-left: auto; }
.rel-actions { display: flex; justify-content: space-between; gap: 12px; margin-top: 20px; }
.rel-actions-right { display: flex; gap: 12px; }

/* 关系创建 */
.rel-create-body { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-bottom: 20px; }
.rel-picker {
  flex: 1; min-width: 140px; padding: 28px 16px; border: 2px dashed #dadce0;
  border-radius: 12px; text-align: center; cursor: pointer; transition: all 0.2s ease;
  background: #fafafa;
}
.rel-picker:hover { border-color: #1a73e8; background: #f0f6ff; }
.rel-picker-selected { border-style: solid; border-color: #1a73e8; background: #e8f0fe; }
.rel-picker-label { font-size: 15px; font-weight: 500; color: #202124; margin-bottom: 4px; }
.rel-picker-hint { font-size: 12px; color: #9aa0a6; }
.rel-arrow-selector { display: flex; flex-direction: column; gap: 6px; }
.arrow-opt {
  width: 44px; height: 44px; border: 2px solid #dadce0; border-radius: 50%;
  background: #fff; font-size: 20px; cursor: pointer; display: flex; align-items: center;
  justify-content: center; transition: all 0.15s ease; color: #5f6368;
}
.arrow-opt:hover { border-color: #1a73e8; color: #1a73e8; }
.arrow-opt.active { background: #1a73e8; color: #fff; border-color: #1a73e8; }
.rel-desc-input { flex-basis: 100%; }

/* 设定选择面板 */
.picker-panel {
  background: #f8fafd; border: 1px solid #e8f0fe; border-radius: 12px; padding: 16px; margin-bottom: 16px;
}
.picker-panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 14px; font-weight: 500; color: #202124; }
.picker-panel-body { max-height: 220px; overflow-y: auto; }
.picker-filters { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.picker-list { display: flex; flex-direction: column; gap: 4px; }
.picker-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: background 0.1s ease;
}
.picker-item:hover { background: #e8f0fe; }
.picker-item-name { font-size: 14px; font-weight: 500; color: #202124; }
.picker-item-type { font-size: 11px; color: #1a73e8; background: rgba(26,115,232,0.08); padding: 1px 8px; border-radius: 10px; }

/* 动画 */
.modal-enter-active { transition: opacity 0.25s ease; }
.modal-enter-active .modal-box { transition: transform 0.3s ease, opacity 0.25s ease; }
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-leave-active .modal-box { transition: transform 0.2s ease, opacity 0.15s ease; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .modal-box { transform: translateY(20px) scale(0.96); opacity: 0; }
.modal-leave-to { opacity: 0; }
.modal-leave-to .modal-box { transform: translateY(10px) scale(0.97); opacity: 0; }

.slide-enter-active { transition: all 0.25s ease; }
.slide-leave-active { transition: all 0.15s ease; }
.slide-enter-from { opacity: 0; max-height: 0; }
.slide-leave-to { opacity: 0; max-height: 0; }

/* Collaborator & Changes sections */
.collab-section, .changes-section {
  background: #fff; border-radius: 12px; padding: 20px;
  margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.collab-section h3, .changes-section h3 { margin: 0 0 12px; font-size: 16px; color: #202124; }
.empty-hint { text-align: center; color: #999; font-size: 13px; padding: 12px; }
.collab-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f3f4; font-size: 14px; }
.collab-row:last-child { border-bottom: none; }
.btn-remove-collab { padding: 4px 12px; background: #fff; color: #d93025; border: 1px solid #f28b82; border-radius: 4px; cursor: pointer; font-size: 12px; }
.btn-remove-collab:hover { background: #fce8e6; }
.btn-manage-collab { padding: 6px 14px; background: #e8f0fe; color: #1a73e8; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; margin-left: 8px; }
.btn-pending-changes { padding: 6px 14px; background: #fef7e0; color: #f9ab00; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; margin-left: 6px; }

.change-card { border: 1px solid #e8eaed; border-radius: 8px; padding: 14px; margin-bottom: 10px; }
.change-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; }
.change-type { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.change-CREATE { background: #e6f4ea; color: #137333; }
.change-UPDATE { background: #e8f0fe; color: #1a73e8; }
.change-DELETE { background: #fce8e6; color: #c5221f; }
.change-user { font-weight: 600; color: #202124; }
.change-time { color: #999; margin-left: auto; }
.change-body { font-size: 14px; color: #5f6368; margin-bottom: 10px; }
.change-body strong { color: #333; }
.change-body p { margin: 4px 0 0; }
.change-actions { display: flex; align-items: center; gap: 10px; }
.btn-approve { padding: 6px 16px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn-approve:hover { background: #1557b0; }
.reject-row { display: flex; gap: 6px; align-items: center; flex: 1; }
.reject-input { flex: 1; padding: 5px 10px; border: 1px solid #dadce0; border-radius: 6px; font-size: 13px; outline: none; }
.reject-input:focus { border-color: #1a73e8; }
.btn-reject { padding: 6px 16px; background: #fff; color: #d93025; border: 1px solid #f28b82; border-radius: 6px; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn-reject:hover { background: #fce8e6; }
</style>
