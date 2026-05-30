<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'

const route = useRoute()
const router = useRouter()
const worldId = Number(route.params.worldId)
const entryId = Number(route.params.entryId)

const DEFAULT_TYPES = ['人物', '地理', '历史', '物品', '生物', '规则', '故事点', '其他']

const entry = ref<any>(null)
const editForm = ref({ name: '', type: '', content: '' })
const isSaving = ref(false)
const message = ref('')
const isLoading = ref(true)

// Related entries (same type or referenced in relations)
const relatedEntries = ref<any[]>([])

async function loadEntry() {
  isLoading.value = true
  try {
    const res = await http.get(`/worlds/${worldId}/entries/${entryId}`)
    const data = res.data
    entry.value = data
    editForm.value = { name: data.name, type: data.type || '', content: data.content }
    // Load related
    loadRelated(data.type)
  } catch (e: any) {
    message.value = e.message || '加载失败'
  } finally {
    isLoading.value = false
  }
}

async function loadRelated(type: string) {
  try {
    const res = await http.get(`/worlds/${worldId}/entries?type=${encodeURIComponent(type || '')}`)
    relatedEntries.value = ((res.data || []) as any[]).filter((e: any) => e.id !== entryId).slice(0, 8)
  } catch { /* */ }
}

async function handleSave() {
  isSaving.value = true; message.value = ''
  try {
    const res = await http.put(`/worlds/${worldId}/entries/${entryId}`, editForm.value)
    const data = res.data as any
    entry.value = data
    editForm.value = { name: data.name, type: data.type || '', content: data.content }
    message.value = '✓ 已保存'
    setTimeout(() => { message.value = '' }, 2000)
  } catch (e: any) {
    message.value = e.message || '保存失败'
  } finally {
    isSaving.value = false
  }
}

// Auto-save
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
const isDirty = ref(false)
watch(editForm, () => { isDirty.value = true })
watch(isDirty, (v) => {
  if (v && entry.value) {
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(handleSave, 5000)
  }
})

function goBack() { router.push(`/create/setting/${worldId}`) }

const wordCount = computed(() => editForm.value.content.length)

onMounted(loadEntry)
</script>

<template>
  <div class="ed-page">
    <!-- Header -->
    <div class="ed-header">
      <button class="ed-back" @click="goBack">← 返回世界</button>
      <div class="ed-header-mid">
        <span class="ed-world-name">#{{ entry?.type || '未知类型' }}</span>
        <span v-if="message" class="ed-saved">{{ message }}</span>
        <span v-else-if="isDirty" class="ed-dirty">未保存</span>
      </div>
      <div class="ed-header-actions">
        <span class="ed-wc">{{ wordCount }} 字</span>
        <button class="ed-save-btn" :disabled="isSaving" @click="handleSave">
          {{ isSaving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="ed-loading">加载中...</div>

    <div v-else class="ed-layout">
      <!-- Left: Editor -->
      <div class="ed-main">
        <!-- Name -->
        <input v-model="editForm.name" class="ed-name-input" placeholder="设定名称" />

        <!-- Type selector -->
        <div class="ed-type-bar">
          <label class="ed-type-label">类型</label>
          <div class="ed-type-chips">
            <button v-for="t in DEFAULT_TYPES" :key="t"
                    :class="['ed-type-chip', { active: editForm.type === t }]"
                    @click="editForm.type = t">{{ t }}</button>
          </div>
        </div>

        <!-- Content area -->
        <textarea
          v-model="editForm.content"
          class="ed-textarea"
          :placeholder="editForm.name ? `描述「${editForm.name}」的细节...` : '在这里编写详细设定...'"
        ></textarea>
      </div>

      <!-- Right: Sidebar -->
      <aside class="ed-sidebar">
        <div class="ed-sb-card">
          <h3>条目信息</h3>
          <div class="ed-sb-stat"><label>名称</label><span>{{ editForm.name || '-' }}</span></div>
          <div class="ed-sb-stat"><label>类型</label><span>{{ editForm.type || '-' }}</span></div>
          <div class="ed-sb-stat"><label>字数</label><span>{{ wordCount }}</span></div>
          <div class="ed-sb-stat"><label>创建</label><span>{{ entry ? new Date(entry.createdAt).toLocaleDateString('zh-CN') : '-' }}</span></div>
          <div class="ed-sb-stat"><label>更新</label><span>{{ entry ? new Date(entry.updatedAt).toLocaleDateString('zh-CN') : '-' }}</span></div>
        </div>

        <div v-if="relatedEntries.length > 0" class="ed-sb-card">
          <h3>同类型条目</h3>
          <div class="ed-related-list">
            <div v-for="r in relatedEntries" :key="r.id"
                 class="ed-related-item"
                 @click="router.push(`/create/setting/${worldId}/entry/${r.id}`)">
              <span class="ed-r-name">{{ r.name }}</span>
              <span class="ed-r-preview">{{ (r.contentPreview || r.content || '').substring(0, 50) }}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.ed-page { max-width: 1100px; margin: 0 auto; padding: 16px 20px; }

/* Header */
.ed-header { display: flex; align-items: center; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid #e8eaed; margin-bottom: 20px; }
.ed-back { background: none; border: none; color: #5f6368; font-size: 14px; cursor: pointer; padding: 6px 10px; border-radius: 6px; font-family: inherit; }
.ed-back:hover { color: #1a73e8; background: #e8f0fe; }
.ed-header-mid { flex: 1; display: flex; align-items: center; gap: 10px; }
.ed-world-name { font-size: 13px; color: #999; }
.ed-saved { font-size: 12px; color: #34a853; }
.ed-dirty { font-size: 12px; color: #e37400; }
.ed-header-actions { display: flex; align-items: center; gap: 10px; }
.ed-wc { font-size: 13px; color: #999; }
.ed-save-btn { padding: 8px 24px; background: #1a73e8; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; }
.ed-save-btn:hover:not(:disabled) { background: #1557b0; }
.ed-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ed-loading { text-align: center; padding: 80px 0; color: #999; }

/* Layout */
.ed-layout { display: grid; grid-template-columns: 1fr 260px; gap: 24px; align-items: start; }

/* Main editor */
.ed-main { min-width: 0; }

.ed-name-input {
  width: 100%; padding: 12px 0; border: none; border-bottom: 2px solid #e8eaed;
  font-size: 24px; font-weight: 600; color: #202124; outline: none; font-family: inherit;
  margin-bottom: 16px;
}
.ed-name-input:focus { border-bottom-color: #1a73e8; }
.ed-name-input::placeholder { color: #bdc1c6; }

.ed-type-bar { margin-bottom: 16px; }
.ed-type-label { font-size: 12px; font-weight: 500; color: #999; margin-bottom: 6px; display: block; }
.ed-type-chips { display: flex; gap: 5px; flex-wrap: wrap; }
.ed-type-chip {
  padding: 4px 12px; border: 1px solid #dadce0; background: #fff; color: #5f6368;
  border-radius: 14px; font-size: 12px; cursor: pointer; font-family: inherit; transition: all 0.15s;
}
.ed-type-chip:hover { border-color: #1a73e8; color: #1a73e8; }
.ed-type-chip.active { background: #1a73e8; color: #fff; border-color: #1a73e8; }

.ed-textarea {
  width: 100%; min-height: 480px; padding: 16px; border: 1px solid #dadce0; border-radius: 10px;
  font-size: 15px; line-height: 1.9; color: #202124; outline: none; resize: vertical;
  font-family: inherit; box-sizing: border-box; transition: border-color 0.2s;
}
.ed-textarea:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,0.06); }
.ed-textarea::placeholder { color: #bdc1c6; }

/* Sidebar */
.ed-sidebar { position: sticky; top: 16px; display: flex; flex-direction: column; gap: 16px; }
.ed-sb-card { background: #fff; border: 1px solid #e8eaed; border-radius: 10px; padding: 16px; }
.ed-sb-card h3 { margin: 0 0 12px 0; font-size: 14px; color: #202124; }
.ed-sb-stat { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
.ed-sb-stat label { color: #999; }
.ed-sb-stat span { color: #202124; font-weight: 500; }

.ed-related-list { display: flex; flex-direction: column; gap: 4px; }
.ed-related-item { display: flex; flex-direction: column; padding: 8px 10px; border-radius: 6px; cursor: pointer; transition: background 0.15s; }
.ed-related-item:hover { background: #f1f3f4; }
.ed-r-name { font-size: 13px; font-weight: 500; color: #202124; }
.ed-r-preview { font-size: 12px; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (max-width: 700px) {
  .ed-layout { grid-template-columns: 1fr; }
  .ed-sidebar { position: static; }
}
</style>
