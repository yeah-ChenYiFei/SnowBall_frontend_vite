<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import type { World } from '@/types'
import WorldCollaboratorModal from '@/components/WorldCollaboratorModal.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'

const router = useRouter()

const worlds = ref<World[]>([])
const isLoading = ref(false)

const form = ref({ name: '', description: '', type: '', isPublic: false })
const isSubmitting = ref(false)
const message = ref('')

const typeOptions = ref(['奇幻', '科幻', '都市', '古风', '末世', '架空历史', '其他'])
const newType = ref('')
const showNewType = ref(false)

const showCollab = ref(false)
const collabWorldId = ref(0)
const collabWorldCollabs = ref<any[]>([])

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

async function loadWorlds() {
  isLoading.value = true
  try { const r = await http.get('/worlds'); worlds.value = (r.data || []) as World[] }
  catch (e: any) { message.value = e.message || '加载失败' }
  finally { isLoading.value = false }
}

function startNewType() { newType.value = ''; showNewType.value = true }
function confirmNewType() {
  const t = newType.value.trim()
  if (t && !typeOptions.value.includes(t)) { typeOptions.value.push(t); form.value.type = t }
  showNewType.value = false
}

async function createWorld() {
  if (!form.value.name.trim()) { message.value = '请输入世界名称'; return }
  if (!form.value.type) { message.value = '请选择世界观类型'; return }
  isSubmitting.value = true; message.value = ''
  try {
    const r = await http.post('/worlds', form.value)
    worlds.value.unshift(r.data as World)
    form.value = { name: '', description: '', type: '', isPublic: false }
  } catch (e: any) { message.value = e.message || '创建失败' }
  finally { isSubmitting.value = false }
}

function goWorld(id: number) { router.push(`/create/setting/${id}`) }

function openCollab(e: Event, w: World) {
  e.stopPropagation()
  collabWorldId.value = w.id; collabWorldCollabs.value = w.collaborators || []; showCollab.value = true
}

onMounted(loadWorlds)
</script>

<template>
  <div class="sw-page">
    <div class="sw-layout">
      <!-- LEFT: World list -->
      <div class="sw-left">
        <div class="sw-section-head">
          <div>
            <h2>我的世界</h2>
            <span class="sw-sub">管理你创建的所有世界观</span>
          </div>
          <span class="sw-count">{{ worlds.length }} 个</span>
        </div>

        <div v-if="isLoading" class="sw-loading">加载中...</div>
        <div v-else-if="worlds.length === 0" class="sw-empty">
          <span class="sw-empty-icon">🌌</span>
          <span>还没有世界，在右侧创建你的第一个世界观</span>
        </div>
        <div v-else class="sw-list">
          <div v-for="w in worlds" :key="w.id" class="sw-card" @click="goWorld(w.id)">
            <div class="swc-top">
              <div class="swc-head">
                <h3 class="swc-name">{{ w.name }}</h3>
                <span v-if="w.isOwner" class="swc-owner">我创建的</span>
                <span v-else-if="w.isCollaborator" class="swc-collab">共创</span>
                <span v-if="!w.isPublic" class="swc-private">私密</span>
              </div>
              <span v-if="w.type" class="swc-type">{{ w.type }}</span>
            </div>
            <div class="swc-meta">
              <span v-if="w.entryCount != null">{{ w.entryCount }} 条目</span>
              <span v-if="w.collaborators?.length">{{ w.collaborators.length }} 共创者</span>
            </div>
            <p v-if="w.description" class="swc-desc">{{ w.description }}</p>
            <div class="swc-foot">
              <span class="swc-date">{{ formatDate(w.updatedAt || w.createdAt) }}</span>
              <button v-if="w.isOwner" class="swc-collab-btn" @click="openCollab($event, w)">
                {{ w.collaborators && w.collaborators.length >= 2 ? '管理' : '共创' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Create form (always visible) -->
      <div class="sw-right">
        <div class="sw-create-card">
          <h2 class="sw-create-head">创建新世界</h2>

          <div v-if="message" class="sw-msg sw-msg-err">{{ message }}</div>

          <div class="sw-field">
            <label class="sw-label">名称</label>
            <input v-model="form.name" class="sw-input sw-input-lg" placeholder="给你的世界起个名字..."
                   @keyup.enter="createWorld" />
          </div>

          <div class="sw-field">
            <label class="sw-label">类型</label>
            <div class="sw-type-row">
              <select v-model="form.type" class="sw-input">
                <option value="" disabled>选择世界观类型</option>
                <option v-for="t in typeOptions" :key="t" :value="t">{{ t }}</option>
              </select>
              <button v-if="!showNewType" class="sw-type-add" @click="startNewType">+ 新类型</button>
            </div>
            <div v-if="showNewType" class="sw-new-type-row">
              <input v-model="newType" class="sw-input" placeholder="输入新类型..." @keyup.enter="confirmNewType" />
              <button class="sw-btn-sm amber" @click="confirmNewType">确定</button>
              <button class="sw-btn-sm" @click="showNewType = false">取消</button>
            </div>
          </div>

          <div class="sw-field">
            <label class="sw-label">简介</label>
            <textarea v-model="form.description" class="sw-input sw-textarea" rows="3"
                      placeholder="简单描述这个世界的背景..."></textarea>
          </div>

          <div class="sw-field sw-field-inline">
            <label class="sw-label">公开世界</label>
            <div class="sw-toggle-row">
              <ToggleSwitch v-model="form.isPublic" />
              <span class="sw-toggle-text">{{ form.isPublic ? '所有人可见' : '仅自己可见' }}</span>
            </div>
          </div>

          <button class="sw-btn-create" :disabled="isSubmitting || !form.name.trim() || !form.type"
                  @click="createWorld">
            {{ isSubmitting ? '创建中...' : '创建世界 ✨' }}
          </button>
        </div>
      </div>
    </div>

    <WorldCollaboratorModal
      :show="showCollab" :world-id="collabWorldId" :existing-collaborators="collabWorldCollabs"
      @close="showCollab = false" @added="loadWorlds" />
  </div>
</template>

<style scoped>
.sw-page { max-width: 1100px; margin: 0 auto; padding: 24px 20px; }

.sw-layout { display: grid; grid-template-columns: 1fr 390px; gap: 28px; align-items: start; }

/* ===== LEFT ===== */
.sw-section-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
.sw-section-head h2 { margin: 0; font-size: 22px; color: #202124; }
.sw-sub { font-size: 13px; color: #999; display: block; margin-top: 2px; }
.sw-count { font-size: 13px; color: #999; }

.sw-loading { text-align: center; padding: 80px 0; color: #999; }
.sw-empty { text-align: center; padding: 60px 20px; color: #999; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.sw-empty-icon { font-size: 40px; }

.sw-list { display: flex; flex-direction: column; gap: 12px; }
.sw-card {
  background: #fff; border: 1px solid #d2e3fc; border-radius: 12px;
  padding: 20px 22px; cursor: pointer; transition: all 0.2s;
}
.sw-card:hover { border-color: #1a73e8; box-shadow: 0 4px 16px rgba(26,115,232,0.08); transform: translateY(-1px); }

.swc-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.swc-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.swc-name { font-size: 17px; font-weight: 600; color: #202124; margin: 0; }
.swc-owner { font-size: 11px; padding: 2px 6px; background: #e8f0fe; color: #1a73e8; border-radius: 6px; }
.swc-collab { font-size: 11px; padding: 2px 6px; background: #e6f4ea; color: #137333; border-radius: 6px; }
.swc-private { font-size: 11px; padding: 2px 6px; background: #f1f3f4; color: #5f6368; border-radius: 6px; }
.swc-type { font-size: 12px; padding: 2px 10px; background: rgba(26,115,232,0.08); color: #1a73e8; border-radius: 12px; }

.swc-meta { display: flex; gap: 14px; font-size: 12px; color: #5f6368; margin-bottom: 8px; }
.swc-desc { font-size: 13px; color: #5f6368; line-height: 1.5; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.swc-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
.swc-date { font-size: 12px; color: #999; }
.swc-collab-btn { padding: 5px 14px; background: #e8f0fe; color: #1a73e8; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: inherit; }
.swc-collab-btn:hover { background: #d2e3fc; }

/* ===== RIGHT ===== */
.sw-right { position: sticky; top: 24px; }

.sw-create-card {
  background: #fff; border: 1px solid #d2e3fc; border-radius: 14px; padding: 28px 26px;
}
.sw-create-head { font-size: 20px; color: #202124; margin: 0 0 20px 0; }

.sw-msg { padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 14px; }
.sw-msg-err { background: #fce8e6; color: #d93025; }

.sw-field { margin-bottom: 18px; }
.sw-label { display: block; font-size: 13px; font-weight: 500; color: #5f6368; margin-bottom: 5px; }
.sw-input { width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; box-sizing: border-box; transition: border-color 0.2s; }
.sw-input:focus { border-color: #1a73e8; box-shadow: 0 0 0 2px rgba(26,115,232,0.1); }
.sw-input-lg { font-size: 17px; font-weight: 500; padding: 12px; }
.sw-textarea { resize: vertical; }

.sw-type-row { display: flex; gap: 8px; align-items: center; }
.sw-type-add { padding: 8px 14px; background: #e8f0fe; color: #1a73e8; border: 1px dashed #1a73e8; border-radius: 8px; font-size: 12px; cursor: pointer; white-space: nowrap; font-family: inherit; }
.sw-type-add:hover { background: #d2e3fc; }

.sw-new-type-row { display: flex; gap: 6px; align-items: center; margin-top: 8px; }
.sw-btn-sm { padding: 6px 14px; border: 1px solid #dadce0; background: #fff; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: inherit; }
.sw-btn-sm.amber { background: #1a73e8; color: #fff; border: none; }
.sw-btn-sm.amber:hover { background: #1557b0; }

.sw-field-inline { display: flex; align-items: center; justify-content: space-between; }
.sw-field-inline .sw-label { margin-bottom: 0; }
.sw-toggle-row { display: flex; align-items: center; gap: 10px; }
.sw-toggle-text { font-size: 13px; color: #5f6368; }

.sw-btn-create {
  width: 100%; margin-top: 6px; padding: 13px 0; border: none;
  background: #1a73e8; color: #fff; border-radius: 10px;
  font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit;
  transition: all 0.2s; box-shadow: 0 2px 10px rgba(26,115,232,0.22);
}
.sw-btn-create:hover:not(:disabled) { background: #1557b0; }
.sw-btn-create:disabled { background: #a8c7fa; cursor: not-allowed; box-shadow: none; }

@media (max-width: 760px) {
  .sw-layout { grid-template-columns: 1fr; }
  .sw-right { position: static; }
}
</style>
