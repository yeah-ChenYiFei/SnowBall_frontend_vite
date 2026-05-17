<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import type { WorldEntry, Result } from '@/types'

const route = useRoute()
const router = useRouter()
const worldId = Number(route.params.worldId)
const entryId = Number(route.params.entryId)

const DEFAULT_TYPES = ['人物', '地理', '历史', '物品', '生物', '规则', '故事点', '其他']

const entry = ref<WorldEntry | null>(null)
const editForm = ref({ name: '', type: '', content: '' })
const isSaving = ref(false)
const message = ref('')

async function loadEntry() {
  try {
    const res = await http.get(`/worlds/${worldId}/entries/${entryId}`) as unknown as Result<WorldEntry>
    if (res.code === 200 && res.data) {
      entry.value = res.data
      editForm.value = { name: res.data.name, type: res.data.type || '', content: res.data.content }
    }
  } catch (e: any) { message.value = e.message || '加载失败' }
}

async function handleSave() {
  isSaving.value = true; message.value = ''
  try {
    const res = await http.put(`/worlds/${worldId}/entries/${entryId}`, editForm.value) as unknown as Result<WorldEntry>
    if (res.code === 200) {
      entry.value = res.data
      message.value = '保存成功'
      setTimeout(() => { message.value = '' }, 2000)
    }
  } catch (e: any) { message.value = e.message || '保存失败' }
  finally { isSaving.value = false }
}

onMounted(loadEntry)
</script>

<template>
  <div class="ed-page">
    <!-- 顶部栏 -->
    <div class="ed-topbar">
      <button class="back-btn" @click="router.push(`/create/setting/${worldId}`)">← 返回世界</button>
      <button class="btn-save" @click="handleSave" :disabled="isSaving">
        {{ isSaving ? '保存中...' : '保存' }}
      </button>
    </div>

    <div v-if="message" class="toast" :class="{ 'toast-success': message === '保存成功', 'toast-error': message !== '保存成功' }">
      {{ message }}
    </div>

    <div v-if="entry" class="ed-body">
      <!-- 标题 -->
      <div class="ed-field">
        <input
          v-model="editForm.name"
          type="text"
          class="ed-title-input"
          placeholder="设定名称"
        />
      </div>

      <!-- 类型 -->
      <div class="ed-field">
        <label class="ed-label">类型</label>
        <select v-model="editForm.type" class="ed-type-select">
          <option value="">选择类型</option>
          <option v-for="t in DEFAULT_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>

      <!-- 内容 -->
      <div class="ed-field">
        <label class="ed-label">内容</label>
        <textarea
          v-model="editForm.content"
          class="ed-content-input"
          rows="20"
          placeholder="在这里编写详细设定..."
        ></textarea>
      </div>
    </div>

    <div v-else class="empty">加载中...</div>
  </div>
</template>

<style scoped>
.ed-page { max-width: 800px; margin: 0 auto; padding: 32px 20px; }

.ed-topbar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 28px;
}

.back-btn {
  background: none; border: none; color: #1a73e8; cursor: pointer;
  font-size: 14px; padding: 0;
}
.back-btn:hover { text-decoration: underline; }

.btn-save {
  padding: 9px 28px; border: none; background: #1a73e8; color: #fff;
  border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;
  transition: background 0.15s ease;
}
.btn-save:hover:not(:disabled) { background: #1557b0; }
.btn-save:disabled { background: #a8c7fa; cursor: not-allowed; }

.toast {
  position: fixed; top: 80px; right: 24px; z-index: 3000;
  padding: 10px 20px; border-radius: 8px; font-size: 14px;
  color: #fff; animation: toastIn 0.3s ease;
}
.toast-success { background: #1e8e3e; }
.toast-error { background: #d93025; }

@keyframes toastIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.ed-body { background: #fff; border-radius: 14px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }

.ed-field { margin-bottom: 24px; }

.ed-title-input {
  width: 100%; padding: 10px 0; border: none; border-bottom: 2px solid #e8f0fe;
  font-size: 26px; font-weight: 600; color: #202124; outline: none; font-family: inherit;
}
.ed-title-input:focus { border-bottom-color: #1a73e8; }

.ed-label { display: block; font-size: 13px; font-weight: 500; color: #5f6368; margin-bottom: 8px; }

.ed-type-select {
  padding: 8px 14px; border: 1px solid #dadce0; border-radius: 8px;
  font-size: 14px; outline: none; font-family: inherit; background: #fff;
}
.ed-type-select:focus { border-color: #1a73e8; }

.ed-content-input {
  width: 100%; padding: 16px; border: 1px solid #dadce0; border-radius: 10px;
  font-size: 15px; line-height: 1.8; color: #202124; outline: none;
  resize: vertical; font-family: inherit; box-sizing: border-box;
}
.ed-content-input:focus { border-color: #1a73e8; box-shadow: 0 0 0 2px rgba(26,115,232,0.08); }

.empty { text-align: center; color: #9aa0a6; padding: 40px 0; font-size: 14px; }
</style>
