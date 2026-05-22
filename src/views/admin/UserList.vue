<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import AdminNav from '@/components/AdminNav.vue'
import type { UserInfo } from '@/types'

const userStore = useUserStore()

const users = ref<UserInfo[]>([])
const search = ref('')
const roleFilter = ref('')
const statusFilter = ref('')
const msg = ref('')

const fetchUsers = async () => {
  try {
    const params: any = { search: search.value || undefined, role: roleFilter.value || undefined, status: statusFilter.value || undefined }
    const res = await http.get<UserInfo[]>('/admin/users', { params })
    users.value = res.data ?? []
  } catch (e: any) {
    msg.value = e.message || '加载失败'
  }
}

onMounted(fetchUsers)
watch([search, roleFilter, statusFilter], fetchUsers)

const setRole = async (id: number, role: string) => {
  try {
    await http.put(`/admin/users/${id}/role`, { role })
    msg.value = '角色已更新'
    fetchUsers()
  } catch (e: any) {
    msg.value = e.message || '操作失败'
  }
}

const toggleStatus = async (id: number, cur: string) => {
  const next = cur === 'ACTIVE' ? 'DELETED' : 'ACTIVE'
  try {
    await http.put(`/admin/users/${id}/status`, { status: next })
    msg.value = '状态已更新'
    fetchUsers()
  } catch (e: any) {
    msg.value = e.message || '操作失败'
  }
}
</script>

<template>
  <div class="user-list">
    <h2>用户管理</h2>
    <AdminNav />
    <div v-if="msg" class="toast">{{ msg }}</div>
    <div class="filters">
      <input v-model="search" placeholder="搜索用户名..." class="search-input" />
      <select v-model="roleFilter" class="filter-select">
        <option value="">全部角色</option>
        <option value="USER">普通用户</option>
        <option value="GROUP_ADMIN">群组管理员</option>
        <option value="SYS_ADMIN">超级管理员</option>
      </select>
      <select v-model="statusFilter" class="filter-select">
        <option value="">全部状态</option>
        <option value="ACTIVE">正常</option>
        <option value="DELETED">已注销</option>
      </select>
    </div>
    <table class="user-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>用户名</th>
          <th>邮箱</th>
          <th>角色</th>
          <th>状态</th>
          <th>注册时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td>{{ u.id }}</td>
          <td>{{ u.username }}</td>
          <td>{{ u.email || '-' }}</td>
          <td>
            <select :value="u.role" @change="setRole(u.id, ($event.target as HTMLSelectElement).value)" class="role-select" :disabled="u.role === 'SYS_ADMIN' && !userStore.isRoot">
              <option value="USER">USER</option>
              <option value="GROUP_ADMIN">GROUP_ADMIN</option>
              <option v-if="userStore.isRoot" value="SYS_ADMIN">SYS_ADMIN</option>
            </select>
          </td>
          <td>
            <span :class="u.status === 'ACTIVE' ? 'status-active' : 'status-deleted'">{{ u.status === 'ACTIVE' ? '正常' : '已注销' }}</span>
          </td>
          <td>{{ u.createdAt?.substring(0, 10) }}</td>
          <td>
            <button v-if="u.role !== 'SYS_ADMIN' && u.status === 'ACTIVE'" @click="toggleStatus(u.id, u.status!)" class="action-btn ban-btn">封禁</button>
            <button v-else-if="u.status === 'DELETED'" @click="toggleStatus(u.id, u.status!)" class="action-btn unban-btn">解封</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.user-list { max-width: 960px; margin: 0 auto; }
h2 { font-size: 20px; font-weight: 500; margin-bottom: 24px; color: #202124; }
.toast { background: #e6f4ea; color: #137333; padding: 8px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
.filters { display: flex; gap: 12px; margin-bottom: 16px; }
.search-input { flex: 1; padding: 8px 12px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; }
.filter-select { padding: 8px 12px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; background: #fff; }
.user-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.user-table th { text-align: left; padding: 12px 16px; font-size: 12px; font-weight: 500; color: #5f6368; background: #f8f9fa; border-bottom: 1px solid #e8eaed; }
.user-table td { padding: 12px 16px; font-size: 13px; color: #202124; border-bottom: 1px solid #f1f3f4; }
.role-select { padding: 4px 8px; border: 1px solid #dadce0; border-radius: 6px; font-size: 12px; background: #fff; }
.action-btn { padding: 4px 12px; border: 1px solid #dadce0; border-radius: 6px; font-size: 12px; cursor: pointer; background: #fff; }
.ban-btn { color: #c5221f; border-color: #fce8e6; }
.ban-btn:hover { background: #fce8e6; }
.unban-btn { color: #137333; border-color: #e6f4ea; }
.unban-btn:hover { background: #e6f4ea; }
.status-active { color: #137333; font-weight: 500; }
.status-deleted { color: #c5221f; font-weight: 500; }
</style>
