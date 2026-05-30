<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import http from '@/api/http'
import type { World } from '@/types'

const router = useRouter()
const route = useRoute()

const editId = computed(() => {
  const id = route.params.id; return id && id !== 'new' ? Number(id) : null
})
const isEdit = computed(() => editId.value !== null)
const isLoading = ref(false)
const isSubmitting = ref(false)
const message = ref('')

// Form
const title = ref('')
const body = ref('')
const fontSize = ref('16')
const lineHeight = ref('1.8')
const isDirty = ref(false)

// Publish
const isPublished = ref(false)

// World binding
const worldId = ref<number | null>(null)
const worldName = ref('')
const bindWorldId = ref(0)
const worlds = ref<World[]>([])

// Auto-save
const autoSavedAt = ref('')
let saveTimer: ReturnType<typeof setTimeout> | null = null

// Stats
const wordCount = computed(() => body.value.length)

async function loadWorlds() {
  try { const r = await http.get<World[]>('/worlds'); worlds.value = r.data || [] } catch { /* */ }
}

async function loadArticle() {
  if (!editId.value) return
  isLoading.value = true
  try {
    const r = await http.get(`/articles/${editId.value}`)
    const d = r.data as any
    title.value = d.title; body.value = d.body || '';
    isPublished.value = d.isPublished || false;
    worldId.value = d.worldId || null; worldName.value = d.worldName || '';
    bindWorldId.value = d.worldId || 0
  } catch (e: any) { message.value = e.message || '加载失败' }
  finally { isLoading.value = false }
}

async function save() {
  if (!title.value.trim() || !body.value.trim()) { message.value = '标题和正文不能为空'; return }
  isSubmitting.value = true; message.value = ''
  try {
    const payload = { title: title.value, body: body.value }
    if (isEdit.value) await http.put(`/articles/${editId.value}`, { ...payload, changeSummary: '编辑散文' })
    else await http.post('/articles', { ...payload, type: 'ESSAY' })
    autoSavedAt.value = new Date().toLocaleTimeString(); isDirty.value = false
    message.value = '已保存'
    setTimeout(() => { message.value = '' }, 2000)
    if (!isEdit.value) router.push('/writing')
  } catch (e: any) { message.value = e.message || '保存失败' }
  finally { isSubmitting.value = false }
}

async function togglePublish() {
  if (!editId.value) return
  try {
    const ep = isPublished.value ? `/articles/${editId.value}/unpublish` : `/articles/${editId.value}/publish`
    const r = await http.post(ep); isPublished.value = (r.data as any).isPublished
  } catch { /* */ }
}

async function bindWorld() {
  if (!bindWorldId.value || !editId.value) return
  try { const r = await http.put(`/articles/${editId.value}/bind-world`, { worldId: bindWorldId.value }); const d = r.data as any; worldId.value = d.worldId; worldName.value = d.worldName || ''; bindWorldId.value = 0 } catch { /* */ }
}
async function unbindWorld() {
  if (!editId.value) return
  try { await http.delete(`/articles/${editId.value}/bind-world`); worldId.value = null; worldName.value = '' } catch { /* */ }
}

watch(body, () => { isDirty.value = true })
watch(isDirty, (v) => {
  if (v && isEdit.value && body.value.trim()) {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      if (!body.value.trim()) return
      try { await http.put(`/articles/${editId.value}`, { title: title.value, body: body.value }); autoSavedAt.value = new Date().toLocaleTimeString(); isDirty.value = false } catch { /* */ }
    }, 6000)
  }
})

const taStyle = computed(() => ({ fontSize: fontSize.value + 'px', lineHeight: lineHeight.value }))

onMounted(() => { loadWorlds(); if (isEdit.value) loadArticle() })
</script>

<template>
  <div class="ee-page">
    <header class="ee-hdr">
      <button class="ee-back" @click="router.push('/writing')">← 闲言碎语</button>
      <div class="ee-hdr-mid">
        <h1 class="ee-type-tag">散文</h1>
        <span v-if="autoSavedAt && !isDirty" class="ee-saved">已保存 {{ autoSavedAt }}</span>
        <span v-else-if="isDirty" class="ee-dirty">未保存</span>
      </div>
      <div class="ee-hdr-actions">
        <button v-if="isEdit" :class="['ee-btn-sm', { on: isPublished }]" @click="togglePublish">{{ isPublished ? '已发布 ✓' : '发布' }}</button>
        <span class="ee-wc">{{ wordCount }} 字</span>
      </div>
    </header>

    <div v-if="message" :class="['ee-msg', message.includes('成功') || message.includes('已') ? 'ok' : 'err']">{{ message }}</div>
    <div v-if="isLoading" class="ee-loading">加载中...</div>

    <div v-else class="ee-body">
      <!-- Title -->
      <input v-model="title" class="ee-title" placeholder="散文标题..." />

      <!-- Toolbar -->
      <div class="ee-bar">
        <div class="ee-bar-g"><label>字号</label><select v-model="fontSize"><option value="14">14</option><option value="16">16</option><option value="18">18</option><option value="20">20</option></select></div>
        <div class="ee-bar-g"><label>行距</label><select v-model="lineHeight"><option value="1.5">1.5</option><option value="1.8">1.8</option><option value="2.0">2.0</option><option value="2.5">2.5</option></select></div>
        <div class="ee-bar-sp"></div>
        <button class="ee-save-btn" :disabled="isSubmitting" @click="save">{{ isSubmitting ? '保存中...' : (isEdit ? '更新' : '发表') }}</button>
      </div>

      <!-- Textarea -->
      <textarea v-model="body" class="ee-ta" :style="taStyle" placeholder="书写你的思绪与文字..."></textarea>
    </div>

    <!-- Side panel (edit mode only) -->
    <aside v-if="isEdit" class="ee-panel">
      <div class="ee-card">
        <h3>散文信息</h3>
        <div class="ee-row"><label>字数</label><span>{{ wordCount }}</span></div>
        <div class="ee-row"><label>状态</label><span :class="isPublished ? 'green' : ''">{{ isPublished ? '已发布' : '未发布' }}</span></div>
        <div class="ee-row"><label>绑定世界</label><span :class="worldName ? 'green' : 'dim'">{{ worldName || '未绑定' }}</span></div>
      </div>
      <div class="ee-card">
        <h3>世界绑定</h3>
        <select v-model="bindWorldId" class="ee-sel"><option :value="0">选择世界...</option><option v-for="w in worlds" :key="w.id" :value="w.id">{{ w.name }}</option></select>
        <div class="ee-btns">
          <button class="ee-btn-sm green" @click="bindWorld" :disabled="bindWorldId === 0">绑定</button>
          <button v-if="worldId" class="ee-btn-sm red" @click="unbindWorld">解绑</button>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.ee-page { max-width: 800px; margin: 0 auto; padding: 16px 20px; }
.ee-hdr { display: flex; align-items: center; gap: 14px; padding-bottom: 14px; border-bottom: 1px solid #e8eaed; margin-bottom: 10px; }
.ee-back { background: none; border: none; color: #5f6368; font-size: 13px; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-family: inherit; }
.ee-back:hover { color: #137333; background: #e6f4ea; }
.ee-hdr-mid { flex: 1; display: flex; align-items: center; gap: 10px; }
.ee-type-tag { font-size: 13px; padding: 3px 10px; background: #e6f4ea; color: #137333; border-radius: 10px; margin: 0; font-weight: 600; }
.ee-saved { font-size: 11px; color: #34a853; }
.ee-dirty { font-size: 11px; color: #e37400; }
.ee-hdr-actions { display: flex; align-items: center; gap: 8px; }
.ee-wc { font-size: 13px; color: #999; }
.ee-btn-sm { padding: 4px 12px; border: 1px solid #dadce0; background: #fff; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: inherit; }
.ee-btn-sm.on { background: #e6f4ea; color: #137333; border-color: #ceead6; }
.ee-msg { padding: 6px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 8px; text-align: center; }
.ee-msg.ok { background: #e6f4ea; color: #137333; }
.ee-msg.err { background: #fce8e6; color: #d93025; }
.ee-loading { text-align: center; padding: 80px; color: #999; }

.ee-body { }
.ee-title { width: 100%; padding: 12px 0; border: none; border-bottom: 2px solid #e8eaed; font-size: 24px; font-weight: 600; color: #202124; outline: none; font-family: inherit; margin-bottom: 14px; box-sizing: border-box; }
.ee-title:focus { border-bottom-color: #137333; }
.ee-title::placeholder { color: #bdc1c6; font-weight: 400; }

.ee-bar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border: 1px solid #e8eaed; border-radius: 8px 8px 0 0; margin-bottom: 0; }
.ee-bar-g { display: flex; align-items: center; gap: 4px; }
.ee-bar-g label { font-size: 12px; color: #999; }
.ee-bar-g select { padding: 4px 6px; border: 1px solid #dadce0; border-radius: 4px; font-size: 13px; outline: none; font-family: inherit; }
.ee-bar-sp { flex: 1; }
.ee-save-btn { padding: 8px 20px; background: #137333; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; }
.ee-save-btn:hover:not(:disabled) { background: #0f5c28; }
.ee-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.ee-ta { width: 100%; min-height: 500px; padding: 16px; border: 1px solid #e8eaed; border-top: none; border-radius: 0 0 8px 8px; font-size: 16px; line-height: 1.8; color: #202124; outline: none; resize: vertical; font-family: inherit; box-sizing: border-box; }
.ee-ta:focus { border-color: #137333; box-shadow: 0 0 0 2px rgba(19,115,51,0.06); }
.ee-ta::placeholder { color: #bdc1c6; }

.ee-panel { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.ee-card { background: #fff; border: 1px solid #e8eaed; border-radius: 10px; padding: 16px; }
.ee-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #202124; }
.ee-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
.ee-row label { color: #999; }
.ee-row span { color: #202124; font-weight: 500; }
.ee-row .green { color: #137333; }
.ee-row .dim { color: #999; }
.ee-sel { width: 100%; padding: 6px 8px; border: 1px solid #dadce0; border-radius: 6px; font-size: 13px; outline: none; margin-bottom: 8px; font-family: inherit; }
.ee-btns { display: flex; gap: 6px; }
.ee-btn-sm.green { flex: 1; padding: 6px 0; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; background: #137333; color: #fff; font-family: inherit; }
.ee-btn-sm.green:hover:not(:disabled) { background: #0f5c28; }
.ee-btn-sm.green:disabled { opacity: 0.5; cursor: not-allowed; }
.ee-btn-sm.red { flex: 1; padding: 6px 0; border: 1px solid #f28b82; border-radius: 6px; font-size: 12px; cursor: pointer; background: #fff; color: #d93025; font-family: inherit; }
.ee-btn-sm.red:hover { background: #fce8e6; }
</style>
