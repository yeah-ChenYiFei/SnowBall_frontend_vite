<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import type { Group } from '@/types'

const router = useRouter()

const myGroups = ref<Group[]>([])
const isLoading = ref(false)

const showDropdown = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

const showSearchModal = ref(false)
const searchQuery = ref('')
const searchResults = ref<Group[]>([])
const isSearching = ref(false)

const showCreateModal = ref(false)
const newGroupName = ref('')
const newGroupDesc = ref('')
const isCreating = ref(false)

onMounted(() => { loadMyGroups() })

async function loadMyGroups() {
  isLoading.value = true
  try {
    const res = await http.get('/groups')
    myGroups.value = (res.data || []) as Group[]
  } catch { /* silent */ }
  finally { isLoading.value = false }
}

function openDropdown() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  showDropdown.value = true
}
function scheduleHide() {
  hideTimer = setTimeout(() => { showDropdown.value = false }, 150)
}

async function doSearch() {
  if (!searchQuery.value.trim()) return
  isSearching.value = true
  try {
    const res = await http.get('/groups/search', { params: { q: searchQuery.value.trim() } })
    searchResults.value = (res.data || []) as Group[]
  } catch { /* silent */ }
  finally { isSearching.value = false }
}

async function joinGroup(groupId: number) {
  try {
    await http.post(`/groups/${groupId}/join`)
    await loadMyGroups()
    searchResults.value = searchResults.value.filter(g => g.id !== groupId)
  } catch (e: any) { alert(e.message || '加入失败') }
}

async function createGroup() {
  if (!newGroupName.value.trim()) return
  isCreating.value = true
  try {
    await http.post('/groups', { name: newGroupName.value.trim(), description: newGroupDesc.value.trim() })
    showCreateModal.value = false
    newGroupName.value = ''
    newGroupDesc.value = ''
    await loadMyGroups()
  } catch (e: any) { alert(e.message || '创建失败') }
  finally { isCreating.value = false }
}

function goToGroup(id: number) { router.push(`/groups/${id}`) }

const avatarColors = ['#1a73e8','#d93025','#1e8e3e','#f9ab00','#9334e6','#185abc','#c5221f','#137333']
function avatarColor(id: number): string { return avatarColors[id % avatarColors.length] }
</script>

<template>
  <div class="groups-page">
    <div class="page-header">
      <h1 class="page-title">我的群组</h1>
      <div class="add-btn-wrapper" @mouseenter="openDropdown" @mouseleave="scheduleHide">
        <button class="btn-add-round">+</button>
        <transition name="dropdown">
          <div v-if="showDropdown" class="dropdown-menu" @mouseenter="openDropdown" @mouseleave="scheduleHide">
            <button class="dropdown-item" @click="showSearchModal = true; showDropdown = false"><span class="item-icon">🔍</span> 搜索群组</button>
            <button class="dropdown-item" @click="showCreateModal = true; showDropdown = false"><span class="item-icon">➕</span> 创建群组</button>
          </div>
        </transition>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state">加载中...</div>
    <div v-else-if="myGroups.length === 0" class="empty-state">
      <div class="empty-icon">👥</div>
      <p>还没有加入任何群组</p>
      <p class="empty-hint">点击右上角 + 搜索或创建群组</p>
    </div>
    <div v-else class="group-grid">
      <div v-for="g in myGroups" :key="g.id" class="group-card" @click="goToGroup(g.id)">
        <div class="card-top">
          <div class="card-avatar" :style="{ background: avatarColor(g.id) }">{{ g.name.charAt(0) }}</div>
          <div class="card-info">
            <h3 class="card-name">{{ g.name }}</h3>
            <p class="card-desc">{{ g.description || '暂无简介' }}</p>
          </div>
        </div>
        <div class="card-footer">
          <span class="card-members">{{ g.memberCount || 0 }} 位成员</span>
          <span v-if="g.creatorName" class="card-creator">群主: {{ g.creatorName }}</span>
        </div>
      </div>
    </div>

    <!-- Search Modal -->
    <Teleport to="body">
      <div v-if="showSearchModal" class="modal-overlay" @click.self="showSearchModal = false; searchResults = []; searchQuery = ''">
        <div class="modal-card">
          <h3>搜索群组</h3>
          <div class="search-row">
            <input v-model="searchQuery" type="text" class="form-input" placeholder="输入群名搜索..." @keyup.enter="doSearch" />
            <button class="btn-search" @click="doSearch" :disabled="isSearching">{{ isSearching ? '...' : '搜索' }}</button>
          </div>
          <div class="search-results">
            <div v-if="searchResults.length === 0 && !isSearching" class="no-results">输入关键词搜索群组</div>
            <div v-for="g in searchResults" :key="g.id" class="search-item">
              <div class="search-item-info">
                <span class="search-item-name">{{ g.name }}</span>
                <span class="search-item-desc">{{ g.description || '暂无简介' }}</span>
                <span class="search-item-meta">{{ g.memberCount || 0 }} 位成员 · 群主: {{ g.creatorName || '未知' }}</span>
              </div>
              <button class="btn-join" @click="joinGroup(g.id)">加入</button>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-cancel" @click="showSearchModal = false; searchResults = []; searchQuery = ''">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Create Modal -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
        <div class="modal-card">
          <h3>创建群组</h3>
          <label class="field-label">群组名称</label>
          <input v-model="newGroupName" type="text" class="form-input" placeholder="给你的群组起个名字" @keyup.enter="createGroup" />
          <label class="field-label">群组简介（可选）</label>
          <textarea v-model="newGroupDesc" class="form-textarea" rows="3" placeholder="简单描述这个群组..."></textarea>
          <div class="modal-actions">
            <button class="btn-cancel" @click="showCreateModal = false">取消</button>
            <button class="btn-submit" @click="createGroup" :disabled="isCreating || !newGroupName.trim()">{{ isCreating ? '创建中...' : '创建' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.groups-page { max-width: 800px; margin: 0 auto; padding: 32px 20px; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }
.page-title { font-size: 26px; font-weight: 700; color: #202124; margin: 0; }
.add-btn-wrapper { position: relative; }
.btn-add-round { width: 40px; height: 40px; border-radius: 50%; border: 2px solid #dadce0; background: #fff; font-size: 22px; color: #5f6368; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.btn-add-round:hover { border-color: #1a73e8; color: #1a73e8; background: #e8f0fe; }
.dropdown-menu { position: absolute; top: calc(100% + 8px); right: 0; min-width: 150px; background: #fff; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.1); border: 1px solid #e8f0fe; padding: 4px 0; z-index: 100; }
.dropdown-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 16px; border: none; background: none; font-size: 14px; color: #202124; cursor: pointer; text-align: left; transition: background 0.15s; }
.dropdown-item:hover { background: #e8f0fe; }
.item-icon { font-size: 15px; }
.dropdown-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.dropdown-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dropdown-enter-from { opacity: 0; transform: translateY(-4px); }
.dropdown-leave-to { opacity: 0; transform: translateY(-4px); }
.loading-state { text-align: center; padding: 60px; color: #999; }
.empty-state { text-align: center; padding: 80px 20px; }
.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-state p { color: #999; margin: 4px 0; font-size: 15px; }
.empty-hint { font-size: 13px !important; color: #bdc1c6 !important; }
.group-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.group-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
.group-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.card-top { display: flex; gap: 14px; margin-bottom: 14px; }
.card-avatar { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; font-weight: 600; flex-shrink: 0; }
.card-info { overflow: hidden; }
.card-name { font-size: 16px; font-weight: 600; color: #202124; margin: 0 0 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-desc { font-size: 13px; color: #5f6368; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-footer { display: flex; justify-content: space-between; font-size: 12px; color: #999; }
.card-creator { color: #5f6368; }
.modal-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.25); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; }
.modal-card { background: #fff; border-radius: 16px; padding: 28px 30px; width: 480px; max-width: 90vw; box-shadow: 0 16px 48px rgba(0,0,0,0.15); }
.modal-card h3 { margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #202124; }
.field-label { display: block; font-size: 13px; font-weight: 500; color: #5f6368; margin: 14px 0 6px 0; }
.form-input { width: 100%; padding: 10px 14px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; outline: none; box-sizing: border-box; font-family: inherit; }
.form-input:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,0.08); }
.form-textarea { width: 100%; padding: 10px 14px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; outline: none; resize: vertical; box-sizing: border-box; font-family: inherit; }
.form-textarea:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,0.08); }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; }
.btn-cancel { padding: 10px 22px; border: 1px solid #dadce0; background: #fff; color: #5f6368; border-radius: 8px; font-size: 14px; cursor: pointer; }
.btn-cancel:hover { background: #f1f3f4; }
.btn-submit { padding: 10px 26px; border: none; background: #1a73e8; color: #fff; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }
.btn-submit:hover:not(:disabled) { background: #1557b0; }
.btn-submit:disabled { background: #a8c7fa; cursor: not-allowed; }
.search-row { display: flex; gap: 8px; margin-bottom: 16px; }
.search-row .form-input { flex: 1; }
.btn-search { padding: 10px 20px; background: #1a73e8; color: #fff; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; white-space: nowrap; }
.btn-search:hover:not(:disabled) { background: #1557b0; }
.btn-search:disabled { background: #a8c7fa; cursor: not-allowed; }
.search-results { max-height: 300px; overflow-y: auto; }
.no-results { text-align: center; color: #999; padding: 20px; font-size: 13px; }
.search-item { display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #f1f3f4; gap: 12px; }
.search-item-info { display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
.search-item-name { font-size: 14px; font-weight: 500; color: #202124; }
.search-item-desc { font-size: 12px; color: #5f6368; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.search-item-meta { font-size: 11px; color: #999; }
.btn-join { padding: 6px 16px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.btn-join:hover { background: #1557b0; }
</style>
