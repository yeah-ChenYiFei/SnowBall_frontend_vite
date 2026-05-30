<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'

const router = useRouter()

// Existing novels
const novels = ref<any[]>([])
const isLoadingNovels = ref(false)

// Create form
const form = ref({ title: '', description: '', hasVolumes: false })
const isSubmitting = ref(false)
const message = ref('')

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

async function loadNovels() {
  isLoadingNovels.value = true
  try { const r = await http.get('/novels'); novels.value = (r.data || []) as any[] } catch {/* */}
  finally { isLoadingNovels.value = false }
}

async function createNovel() {
  if (!form.value.title.trim()) { message.value = '请输入书名'; return }
  isSubmitting.value = true; message.value = ''
  try {
    const r = await http.post('/novels', {
      title: form.value.title.trim(),
      description: form.value.description,
      hasVolumes: form.value.hasVolumes,
    })
    router.push(`/writing/novel/${(r.data as any).id}`)
  } catch (e: any) { message.value = e.message || '创建失败' }
  finally { isSubmitting.value = false }
}

function goNovel(id: number) { router.push(`/writing/novel/${id}`) }

onMounted(loadNovels)
</script>

<template>
  <div class="nh-page">
    <!-- Two-column layout -->
    <div class="nh-layout">
      <!-- LEFT: Novel list -->
      <div class="nh-left">
        <div class="nh-section-head">
          <h2>我的小说</h2>
          <span class="nh-count">{{ novels.length }} 部</span>
        </div>

        <div v-if="isLoadingNovels" class="nh-loading">加载中...</div>
        <div v-else-if="novels.length === 0" class="nh-empty">
          <span class="nh-empty-icon">📖</span>
          <span>还没有小说，在右侧创建你的第一部作品</span>
        </div>
        <div v-else class="nh-novel-list">
          <div v-for="n in novels" :key="n.id" class="nh-novel-card" @click="goNovel(n.id)">
            <div class="nh-card-top">
              <h3 class="nh-card-title">{{ n.title }}</h3>
              <span v-if="n.isPublished" class="nh-pub-badge">已发布</span>
            </div>
            <div class="nh-card-meta">
              <span v-if="n.chapterCount != null">{{ n.chapterCount }} 章</span>
              <span v-if="n.totalWordCount != null">{{ n.totalWordCount?.toLocaleString() }} 字</span>
              <span v-if="n.worldName">📖 {{ n.worldName }}</span>
            </div>
            <p v-if="n.description" class="nh-card-desc">{{ n.description }}</p>
            <div class="nh-card-foot">
              <span class="nh-card-date">{{ formatDate(n.updatedAt || n.createdAt) }}</span>
              <span class="nh-card-arrow">→</span>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Create form -->
      <div class="nh-right">
        <div class="nh-create-card">
          <h2 class="nh-create-title">创建新小说</h2>
          <p class="nh-create-sub">为你的故事起个名字</p>

          <div v-if="message" class="nh-msg nh-msg-err">{{ message }}</div>

          <div class="nh-field">
            <label class="nh-label">书名</label>
            <input v-model="form.title" class="nh-input nh-input-lg"
                   placeholder="给你的小说起个名字..." @keyup.enter="createNovel" autofocus />
          </div>

          <div class="nh-field">
            <label class="nh-label">分卷模式</label>
            <div class="nh-toggle-row">
              <button :class="['nh-toggle', { on: form.hasVolumes }]" @click="form.hasVolumes = !form.hasVolumes">
                <span class="nh-toggle-knob"></span>
              </button>
              <span class="nh-toggle-text">{{ form.hasVolumes ? '分卷' : '不分卷' }}</span>
            </div>
          </div>

          <div class="nh-field">
            <label class="nh-label">简介（可选）</label>
            <textarea v-model="form.description" class="nh-input nh-textarea"
                      placeholder="一句话介绍你的故事..." rows="3"></textarea>
          </div>

          <button class="nh-submit-btn" :disabled="isSubmitting || !form.title.trim()" @click="createNovel">
            {{ isSubmitting ? '创建中...' : '开始写作 ✨' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nh-page { max-width: 1100px; margin: 0 auto; padding: 24px 20px; }
.nh-layout { display: grid; grid-template-columns: 1fr 380px; gap: 28px; align-items: start; }

/* === LEFT === */
.nh-section-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 16px; }
.nh-section-head h2 { margin: 0; font-size: 20px; color: #202124; }
.nh-count { font-size: 13px; color: #999; }
.nh-loading { text-align: center; padding: 60px; color: #999; }
.nh-empty { text-align: center; padding: 60px 20px; color: #999; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.nh-empty-icon { font-size: 40px; }

.nh-novel-list { display: flex; flex-direction: column; gap: 10px; }
.nh-novel-card {
  background: #fff; border: 1px solid #fde68a; border-radius: 12px; padding: 18px 20px;
  cursor: pointer; transition: all 0.2s;
}
.nh-novel-card:hover { border-color: #d97706; box-shadow: 0 4px 16px rgba(217,119,6,0.1); transform: translateY(-1px); }
.nh-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.nh-card-title { font-size: 17px; font-weight: 600; color: #202124; margin: 0; }
.nh-pub-badge { font-size: 11px; padding: 2px 8px; background: #e6f4ea; color: #137333; border-radius: 8px; }
.nh-card-meta { display: flex; gap: 12px; font-size: 12px; color: #5f6368; margin-bottom: 6px; }
.nh-card-desc { font-size: 13px; color: #5f6368; line-height: 1.5; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.nh-card-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
.nh-card-date { font-size: 12px; color: #999; }
.nh-card-arrow { color: #d97706; font-size: 16px; }

/* === RIGHT === */
.nh-right { position: sticky; top: 24px; }
.nh-create-card { background: #fff; border: 1px solid #fde68a; border-radius: 14px; padding: 28px 26px; }
.nh-create-title { font-size: 22px; font-weight: 700; color: #202124; margin: 0 0 4px 0; }
.nh-create-sub { font-size: 13px; color: #999; margin: 0 0 24px 0; }
.nh-msg { padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 12px; }
.nh-msg-err { background: #fce8e6; color: #d93025; }
.nh-field { margin-bottom: 18px; }
.nh-label { display: block; font-size: 13px; font-weight: 500; color: #5f6368; margin-bottom: 5px; }
.nh-input { width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; outline: none; box-sizing: border-box; font-family: inherit; transition: border-color 0.2s; }
.nh-input:focus { border-color: #d97706; box-shadow: 0 0 0 2px rgba(217,119,6,0.1); }
.nh-input-lg { font-size: 17px; font-weight: 500; padding: 12px; }
.nh-textarea { resize: vertical; }
.nh-toggle-row { display: flex; align-items: center; gap: 10px; }
.nh-toggle { width: 48px; height: 26px; border-radius: 13px; border: none; background: #dadce0; cursor: pointer; position: relative; padding: 0; transition: background 0.25s; }
.nh-toggle.on { background: #d97706; }
.nh-toggle-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform 0.25s; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
.nh-toggle.on .nh-toggle-knob { transform: translateX(22px); }
.nh-toggle-text { font-size: 14px; font-weight: 500; }
.nh-submit-btn {
  width: 100%; margin-top: 8px; padding: 13px 0; background: #d97706; color: #fff; border: none;
  border-radius: 10px; font-size: 16px; font-weight: 500; cursor: pointer; font-family: inherit;
  transition: all 0.25s; box-shadow: 0 2px 12px rgba(217,119,6,0.25);
}
.nh-submit-btn:hover:not(:disabled) { background: #b45309; }
.nh-submit-btn:disabled { background: #fde68a; cursor: not-allowed; box-shadow: none; }

@media (max-width: 760px) {
  .nh-layout { grid-template-columns: 1fr; }
  .nh-right { position: static; }
}
</style>
