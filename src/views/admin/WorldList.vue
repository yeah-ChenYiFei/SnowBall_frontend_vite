<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import http from '@/api/http'
import AdminNav from '@/components/AdminNav.vue'

const worlds = ref<any[]>([])
const search = ref('')
const publicFilter = ref('')
const page = ref(1)
const msg = ref('')

const fetchWorlds = async () => {
  try {
    const params: any = {
      search: search.value || undefined,
      isPublic: publicFilter.value || undefined,
      page: page.value,
    }
    const res = await http.get<any[]>('/admin/worlds', { params })
    worlds.value = res.data ?? []
  } catch (e: any) {
    msg.value = e.message || '加载失败'
  }
}

onMounted(fetchWorlds)
watch([search, publicFilter], () => {
  page.value = 1
  fetchWorlds()
})

const deleteWorld = async (id: number) => {
  if (!confirm('确定删除该世界？此操作不可恢复。')) return
  try {
    await http.delete(`/admin/worlds/${id}`)
    msg.value = '世界已删除'
    fetchWorlds()
  } catch (e: any) {
    msg.value = e.message || '操作失败'
  }
}
</script>

<template>
  <div class="world-list">
    <h2>世界管理</h2>
    <AdminNav />
    <div v-if="msg" class="toast">{{ msg }}</div>
    <div class="filters">
      <input v-model="search" placeholder="搜索名称..." class="search-input" />
      <select v-model="publicFilter" class="filter-select">
        <option value="">全部可见性</option>
        <option value="true">公开</option>
        <option value="false">私有</option>
      </select>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>名称</th>
          <th>可见性</th>
          <th>所有者ID</th>
          <th>创建时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="w in worlds" :key="w.id">
          <td>{{ w.id }}</td>
          <td>{{ w.name }}</td>
          <td>
            <span :class="w.isPublic ? 'status-pub' : 'status-priv'">{{ w.isPublic ? '公开' : '私有' }}</span>
          </td>
          <td>{{ w.userId }}</td>
          <td>{{ w.createdAt?.substring(0, 10) }}</td>
          <td>
            <button @click="deleteWorld(w.id)" class="action-btn del-btn">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="pager">
      <button :disabled="page <= 1" @click="page--; fetchWorlds()">上一页</button>
      <span>第 {{ page }} 页</span>
      <button @click="page++; fetchWorlds()">下一页</button>
    </div>
  </div>
</template>

<style scoped>
.world-list { max-width: 960px; margin: 0 auto; }
h2 { font-size: 20px; font-weight: 500; margin-bottom: 24px; color: #202124; }
.toast { background: #e6f4ea; color: #137333; padding: 8px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
.filters { display: flex; gap: 12px; margin-bottom: 16px; }
.search-input { flex: 1; padding: 8px 12px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; }
.filter-select { padding: 8px 12px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; background: #fff; }
.data-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.data-table th { text-align: left; padding: 12px 16px; font-size: 12px; font-weight: 500; color: #5f6368; background: #f8f9fa; border-bottom: 1px solid #e8eaed; }
.data-table td { padding: 12px 16px; font-size: 13px; color: #202124; border-bottom: 1px solid #f1f3f4; }
.action-btn { padding: 4px 12px; border: 1px solid #dadce0; border-radius: 6px; font-size: 12px; cursor: pointer; background: #fff; }
.del-btn { color: #c5221f; border-color: #fce8e6; }
.del-btn:hover { background: #fce8e6; }
.status-pub { color: #137333; font-weight: 500; }
.status-priv { color: #e37400; font-weight: 500; }
.pager { display: flex; align-items: center; gap: 12px; margin-top: 16px; font-size: 13px; color: #5f6368; }
.pager button { padding: 6px 14px; border: 1px solid #dadce0; border-radius: 8px; background: #fff; cursor: pointer; font-size: 13px; }
.pager button:disabled { opacity: 0.4; cursor: default; }
</style>
