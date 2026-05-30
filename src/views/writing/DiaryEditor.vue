<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import http from '@/api/http'

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
const mood = ref('')
const weather = ref('')
const fontSize = ref('16')
const lineHeight = ref('1.8')
const isDirty = ref(false)
const streak = ref(0)

// Auto-save
const autoSavedAt = ref('')
let saveTimer: ReturnType<typeof setTimeout> | null = null

// Stats
const wordCount = computed(() => body.value.length)

const moods = ['😊', '😌', '😢', '😤', '🥰', '😴', '🤔', '✨', '🔥', '💪']
const moodLabels = ['开心', '平静', '难过', '生气', '幸福', '疲惫', '沉思', '灵感', '热情', '努力']
const weathers = ['☀️', '⛅', '☁️', '🌧️', '⛈️', '🌨️', '🌬️', '🌈']

function getTodayTitle() {
  const t = new Date()
  return `${t.getFullYear()}年${t.getMonth() + 1}月${t.getDate()}日 日记`
}

async function loadStreak() {
  try { const r = await http.get('/articles/diary-streak'); streak.value = (r.data as number) ?? 0 } catch { streak.value = 0 }
}

async function loadArticle() {
  if (!editId.value) return
  isLoading.value = true
  try {
    const r = await http.get(`/articles/${editId.value}`)
    const d = r.data as any
    title.value = d.title; body.value = d.body || ''; isDirty.value = false
    // Try to extract mood/weather from title or chapter field
    const ch = d.chapter || ''
    if (ch.startsWith('mood:')) {
      const parts = ch.split(':')
      mood.value = parts[1] || ''; weather.value = parts[2] || ''
    }
  } catch (e: any) { message.value = e.message || '加载失败' }
  finally { isLoading.value = false }
}

async function save() {
  if (!body.value.trim()) { message.value = '请写点什么吧'; return }
  isSubmitting.value = true; message.value = ''
  const t = title.value.trim() || getTodayTitle()
  const ch = `mood:${mood.value}:${weather.value}`
  try {
    const payload = { title: t, body: body.value, chapter: ch }
    if (isEdit.value) await http.put(`/articles/${editId.value}`, { ...payload, changeSummary: '编辑日记' })
    else {
      const r = await http.post('/articles', { ...payload, type: 'DIARY' })
      if (!isEdit.value) router.replace({ path: `/writing/diary/${(r.data as any).id}` })
    }
    autoSavedAt.value = new Date().toLocaleTimeString(); isDirty.value = false
    message.value = '已保存'; setTimeout(() => { message.value = '' }, 2000)
    loadStreak()
  } catch (e: any) { message.value = e.message || '保存失败' }
  finally { isSubmitting.value = false }
}

watch(body, () => { isDirty.value = true })
watch(isDirty, (v) => {
  if (v && isEdit.value && body.value.trim()) {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      const t = title.value.trim() || getTodayTitle()
      try { await http.put(`/articles/${editId.value}`, { title: t, body: body.value, chapter: `mood:${mood.value}:${weather.value}` }); autoSavedAt.value = new Date().toLocaleTimeString(); isDirty.value = false } catch { /* */ }
    }, 5000)
  }
})

const taStyle = computed(() => ({ fontSize: fontSize.value + 'px', lineHeight: lineHeight.value }))

onMounted(() => { loadStreak(); if (isEdit.value) loadArticle(); else title.value = getTodayTitle() })
</script>

<template>
  <div class="de-page">
    <header class="de-hdr">
      <button class="de-back" @click="router.push('/writing')">← 闲言碎语</button>
      <div class="de-hdr-mid">
        <h1 class="de-type-tag">日记</h1>
        <span v-if="autoSavedAt && !isDirty" class="de-saved">已保存 {{ autoSavedAt }}</span>
        <span v-else-if="isDirty" class="de-dirty">未保存</span>
      </div>
      <div class="de-hdr-actions">
        <span class="de-wc">{{ wordCount }} 字</span>
      </div>
    </header>

    <div v-if="message" :class="['de-msg', message.includes('已') ? 'ok' : 'err']">{{ message }}</div>
    <div v-if="isLoading" class="de-loading">加载中...</div>

    <div v-else class="de-layout">
      <!-- Main writing area -->
      <div class="de-main">
        <!-- Streak bar -->
        <div class="de-streak">
          <div class="de-streak-left">
            <span class="de-streak-label">连续写作</span>
            <span class="de-streak-num">{{ streak }}</span>
            <span class="de-streak-unit">天</span>
          </div>
          <div class="de-streak-right">
            <div class="de-meta-pickers">
              <div class="de-picker-g">
                <label>心情</label>
                <div class="de-chips">
                  <button v-for="(m, i) in moods" :key="m" :class="['de-chip', { on: mood === m }]" :title="moodLabels[i]" @click="mood = mood === m ? '' : m">{{ m }}</button>
                </div>
              </div>
              <div class="de-picker-g">
                <label>天气</label>
                <div class="de-chips">
                  <button v-for="w in weathers" :key="w" :class="['de-chip', { on: weather === w }]" @click="weather = weather === w ? '' : w">{{ w }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Title -->
        <input v-model="title" class="de-title" :placeholder="getTodayTitle()" />

        <!-- Toolbar -->
        <div class="de-bar">
          <div class="de-bar-g"><label>字号</label><select v-model="fontSize"><option value="14">14</option><option value="16">16</option><option value="18">18</option><option value="20">20</option></select></div>
          <div class="de-bar-g"><label>行距</label><select v-model="lineHeight"><option value="1.5">1.5</option><option value="1.8">1.8</option><option value="2.0">2.0</option><option value="2.5">2.5</option></select></div>
          <div class="de-bar-sp"></div>
          <button class="de-save-btn" :disabled="isSubmitting" @click="save">{{ isSubmitting ? '保存中...' : (isEdit ? '更新日记' : '写日记') }}</button>
        </div>

        <!-- Textarea -->
        <textarea v-model="body" class="de-ta" :style="taStyle" placeholder="今天发生了什么？记录下此刻的心情..."></textarea>
      </div>
    </div>
  </div>
</template>

<style scoped>
.de-page { max-width: 800px; margin: 0 auto; padding: 16px 20px; }
.de-hdr { display: flex; align-items: center; gap: 14px; padding-bottom: 14px; border-bottom: 1px solid #e8eaed; margin-bottom: 10px; }
.de-back { background: none; border: none; color: #5f6368; font-size: 13px; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-family: inherit; }
.de-back:hover { color: #d93025; background: #fce8e6; }
.de-hdr-mid { flex: 1; display: flex; align-items: center; gap: 10px; }
.de-type-tag { font-size: 13px; padding: 3px 10px; background: #fce8e6; color: #d93025; border-radius: 10px; margin: 0; font-weight: 600; }
.de-saved { font-size: 11px; color: #34a853; }
.de-dirty { font-size: 11px; color: #e37400; }
.de-hdr-actions { display: flex; align-items: center; gap: 8px; }
.de-wc { font-size: 13px; color: #999; }
.de-msg { padding: 6px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 8px; text-align: center; }
.de-msg.ok { background: #e6f4ea; color: #137333; }
.de-msg.err { background: #fce8e6; color: #d93025; }
.de-loading { text-align: center; padding: 80px; color: #999; }

.de-layout { }
.de-main { }

.de-streak { display: flex; align-items: center; gap: 20px; padding: 14px 18px; background: #fff; border: 1px solid #fce8e6; border-radius: 10px; margin-bottom: 16px; }
.de-streak-left { display: flex; align-items: baseline; gap: 4px; flex-shrink: 0; }
.de-streak-label { font-size: 12px; color: #999; }
.de-streak-num { font-size: 32px; font-weight: 800; color: #d93025; line-height: 1; }
.de-streak-unit { font-size: 13px; color: #5f6368; }
.de-streak-right { flex: 1; }
.de-meta-pickers { display: flex; flex-direction: column; gap: 6px; }
.de-picker-g { display: flex; align-items: center; gap: 6px; }
.de-picker-g label { font-size: 12px; color: #999; width: 28px; }
.de-chips { display: flex; gap: 3px; flex-wrap: wrap; }
.de-chip { width: 28px; height: 28px; border-radius: 50%; border: 1px solid #e8eaed; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; padding: 0; transition: all 0.15s; }
.de-chip:hover { border-color: #d93025; }
.de-chip.on { background: #fce8e6; border-color: #d93025; }

.de-title { width: 100%; padding: 10px 0; border: none; border-bottom: 2px solid #e8eaed; font-size: 22px; font-weight: 600; color: #202124; outline: none; font-family: inherit; margin-bottom: 12px; box-sizing: border-box; }
.de-title:focus { border-bottom-color: #d93025; }
.de-title::placeholder { color: #bdc1c6; font-weight: 400; }

.de-bar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border: 1px solid #e8eaed; border-radius: 8px 8px 0 0; }
.de-bar-g { display: flex; align-items: center; gap: 4px; }
.de-bar-g label { font-size: 12px; color: #999; }
.de-bar-g select { padding: 4px 6px; border: 1px solid #dadce0; border-radius: 4px; font-size: 13px; outline: none; font-family: inherit; }
.de-bar-sp { flex: 1; }
.de-save-btn { padding: 8px 20px; background: #d93025; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; }
.de-save-btn:hover:not(:disabled) { background: #b71c1c; }
.de-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.de-ta { width: 100%; min-height: 500px; padding: 16px; border: 1px solid #e8eaed; border-top: none; border-radius: 0 0 8px 8px; font-size: 16px; line-height: 1.8; color: #202124; outline: none; resize: vertical; font-family: inherit; box-sizing: border-box; }
.de-ta:focus { border-color: #d93025; box-shadow: 0 0 0 2px rgba(217,48,37,0.06); }
.de-ta::placeholder { color: #bdc1c6; }
</style>
