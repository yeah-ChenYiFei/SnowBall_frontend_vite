<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import http from '@/api/http'

/* ================================================================
   State
   ================================================================ */
const inspirations = ref<Inspiration[]>([])
const isLoading = ref(false)
const searchQuery = ref('')

// Create
const showCreate = ref(false)
const newContent = ref('')
const isSubmitting = ref(false)

// Edit
const showEdit = ref(false)
const editingId = ref(0)
const editingContent = ref('')

// View detail modal
const showDetail = ref(false)
const detailContent = ref('')
const detailDate = ref('')

/* ================================================================
   Computed
   ================================================================ */
const filtered = computed(() => {
  if (!searchQuery.value.trim()) return inspirations.value
  const q = searchQuery.value.toLowerCase()
  return inspirations.value.filter(i => i.content.toLowerCase().includes(q))
})

const totalCount = computed(() => inspirations.value.length)

/* ================================================================
   Methods
   ================================================================ */
async function load() {
  isLoading.value = true
  try { const r = await http.get<Inspiration[]>('/inspirations'); inspirations.value = r.data || [] } catch { /* */ }
  finally { isLoading.value = false }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function openCreate() { newContent.value = ''; showCreate.value = true }

async function submit() {
  const c = newContent.value.trim(); if (!c) return
  isSubmitting.value = true
  try {
    const r = await http.post<Inspiration>('/inspirations', { content: c })
    inspirations.value.unshift(r.data as any)
    showCreate.value = false
  } catch (e: any) { alert(e.message || '记录失败') }
  finally { isSubmitting.value = false }
}

function openEdit(item: Inspiration) {
  editingId.value = item.id; editingContent.value = item.content; showEdit.value = true
}

async function saveEdit() {
  const c = editingContent.value.trim(); if (!c || !editingId.value) return
  try {
    await http.put(`/inspirations/${editingId.value}`, { content: c })
    const idx = inspirations.value.findIndex(i => i.id === editingId.value)
    if (idx >= 0) inspirations.value[idx].content = c
    showEdit.value = false
  } catch (e: any) { alert(e.message || '保存失败') }
}

async function deleteItem(id: number) {
  if (!confirm('删除这条灵感？')) return
  try { await http.delete(`/inspirations/${id}`); inspirations.value = inspirations.value.filter(i => i.id !== id); showEdit.value = false } catch { /* */ }
}

function openDetail(item: Inspiration) {
  detailContent.value = item.content; detailDate.value = formatDate(item.createdAt); showDetail.value = true
}

// Keyboard shortcut
function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); openCreate() }
}

onMounted(() => { load(); document.addEventListener('keydown', onKeydown) })
onUnmounted(() => { document.removeEventListener('keydown', onKeydown) })
</script>

<template>
  <div class="in-page">
    <!-- Header -->
    <header class="in-hdr">
      <div class="in-hdr-mid">
        <h1 class="in-type-tag">灵感</h1>
        <span class="in-count">{{ totalCount }} 条</span>
        <span class="in-shortcut">Ctrl+I 快速记录</span>
      </div>
      <div class="in-hdr-actions">
        <input v-model="searchQuery" class="in-search" placeholder="搜索灵感..." />
        <button class="in-create-btn" @click="openCreate">+ 记录灵感</button>
      </div>
    </header>

    <div v-if="isLoading" class="in-loading">加载中...</div>

    <!-- Card grid -->
    <div v-else-if="filtered.length === 0" class="in-empty">
      <span class="in-empty-icon">✨</span>
      <span>{{ searchQuery ? '没有匹配的灵感' : '还没有灵感，点击上方按钮记录第一个' }}</span>
    </div>

    <div v-else class="in-grid">
      <div v-for="item in filtered" :key="item.id" class="in-card" @click="openDetail(item)">
        <div class="in-card-body">{{ item.content }}</div>
        <div class="in-card-foot">
          <span class="in-card-date">{{ formatDate(item.createdAt) }}</span>
          <div class="in-card-actions" @click.stop>
            <button class="in-card-btn" @click="openEdit(item)" title="编辑">✏️</button>
            <button class="in-card-btn del" @click="deleteItem(item.id)" title="删除">✕</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== CREATE MODAL ===== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreate" class="in-overlay" @click.self="showCreate = false">
          <div class="in-modal">
            <h2>记录灵感</h2>
            <textarea v-model="newContent" class="in-ta" placeholder="捕捉此刻灵感..." rows="5" autofocus @keydown.ctrl.enter="submit"></textarea>
            <div class="in-m-actions">
              <button class="in-m-cancel" @click="showCreate = false">取消</button>
              <button class="in-m-submit" :disabled="!newContent.trim() || isSubmitting" @click="submit">{{ isSubmitting ? '记录中...' : '记录' }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ===== EDIT MODAL ===== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showEdit" class="in-overlay" @click.self="showEdit = false">
          <div class="in-modal">
            <h2>编辑灵感</h2>
            <textarea v-model="editingContent" class="in-ta" rows="5" autofocus @keydown.ctrl.enter="saveEdit"></textarea>
            <div class="in-m-actions">
              <button class="in-m-del" @click="deleteItem(editingId)">删除</button>
              <div class="in-m-right">
                <button class="in-m-cancel" @click="showEdit = false">取消</button>
                <button class="in-m-submit" :disabled="!editingContent.trim()" @click="saveEdit">保存</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ===== DETAIL MODAL ===== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDetail" class="in-overlay" @click.self="showDetail = false">
          <div class="in-modal in-detail">
            <div class="in-d-hdr">
              <span class="in-type-tag">灵感</span>
              <span class="in-d-date">{{ detailDate }}</span>
            </div>
            <div class="in-d-body">{{ detailContent }}</div>
            <div class="in-m-actions">
              <button class="in-m-cancel" @click="showDetail = false">关闭</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.in-page { max-width: 900px; margin: 0 auto; padding: 20px; }

/* Header */
.in-hdr { display: flex; align-items: center; gap: 14px; padding-bottom: 16px; border-bottom: 1px solid #e8eaed; margin-bottom: 20px; }
.in-hdr-mid { display: flex; align-items: center; gap: 10px; flex: 1; }
.in-type-tag { font-size: 13px; padding: 3px 10px; background: #ede9fe; color: #7c3aed; border-radius: 10px; margin: 0; font-weight: 600; }
.in-count { font-size: 13px; color: #999; }
.in-shortcut { font-size: 11px; color: #bdc1c6; }
.in-hdr-actions { display: flex; align-items: center; gap: 8px; }
.in-search { padding: 7px 12px; border: 1px solid #dadce0; border-radius: 16px; font-size: 13px; outline: none; width: 160px; font-family: inherit; }
.in-search:focus { border-color: #7c3aed; }
.in-create-btn { padding: 8px 18px; background: #7c3aed; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; white-space: nowrap; }
.in-create-btn:hover { background: #6d28d9; }

.in-loading { text-align: center; padding: 80px; color: #999; }
.in-empty { text-align: center; padding: 60px 20px; color: #999; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.in-empty-icon { font-size: 40px; }

/* Card grid */
.in-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.in-card { background: #fff; border: 1px solid #e8eaed; border-radius: 10px; padding: 16px 18px; cursor: pointer; transition: all 0.15s; display: flex; flex-direction: column; }
.in-card:hover { border-color: #7c3aed; box-shadow: 0 2px 8px rgba(124,58,237,0.08); }
.in-card-body { font-size: 14px; line-height: 1.7; color: #333; flex: 1; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 10px; }
.in-card-foot { display: flex; align-items: center; justify-content: space-between; }
.in-card-date { font-size: 11px; color: #999; }
.in-card-actions { display: flex; gap: 2px; }
.in-card-btn { background: none; border: none; font-size: 13px; color: #999; cursor: pointer; padding: 2px 4px; border-radius: 4px; }
.in-card-btn:hover { color: #7c3aed; background: #ede9fe; }
.in-card-btn.del:hover { color: #d93025; background: #fce8e6; }

/* Modals */
.in-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; padding: 24px; backdrop-filter: blur(4px); }
.in-modal { background: #fff; border-radius: 14px; padding: 26px; width: 100%; max-width: 500px; box-shadow: 0 16px 48px rgba(0,0,0,0.15); }
.in-modal h2 { margin: 0 0 16px 0; font-size: 18px; color: #202124; }
.in-detail { max-width: 560px; }
.in-ta { width: 100%; padding: 12px; border: 1px solid #dadce0; border-radius: 8px; font-size: 15px; line-height: 1.7; color: #202124; resize: vertical; font-family: inherit; outline: none; box-sizing: border-box; }
.in-ta:focus { border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124,58,237,0.1); }
.in-m-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 16px; }
.in-m-right { display: flex; gap: 10px; margin-left: auto; }
.in-m-cancel { padding: 9px 20px; border: 1px solid #dadce0; background: #fff; border-radius: 8px; font-size: 14px; color: #5f6368; cursor: pointer; font-family: inherit; }
.in-m-cancel:hover { background: #f1f3f4; }
.in-m-submit { padding: 9px 22px; border: none; background: #7c3aed; color: #fff; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; }
.in-m-submit:hover:not(:disabled) { background: #6d28d9; }
.in-m-submit:disabled { opacity: 0.5; cursor: not-allowed; }
.in-m-del { padding: 9px 20px; border: 1px solid #f28b82; background: #fff; color: #d93025; border-radius: 8px; font-size: 14px; cursor: pointer; font-family: inherit; margin-right: auto; }
.in-m-del:hover { background: #fce8e6; }

.in-d-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid #e8eaed; }
.in-d-date { font-size: 13px; color: #999; }
.in-d-body { font-size: 15px; line-height: 1.9; color: #333; white-space: pre-wrap; max-height: 60vh; overflow-y: auto; }

/* Modal transitions */
.modal-enter-active { transition: opacity 0.25s; }
.modal-enter-active .in-modal { transition: transform 0.3s, opacity 0.25s; }
.modal-leave-active { transition: opacity 0.2s; }
.modal-leave-active .in-modal { transition: transform 0.2s, opacity 0.15s; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .in-modal { transform: scale(0.92) translateY(16px); opacity: 0; }
.modal-leave-to { opacity: 0; }
.modal-leave-to .in-modal { transform: scale(0.95); opacity: 0; }
</style>
