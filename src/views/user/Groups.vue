<script setup lang="ts">
import { ref, onMounted } from 'vue'
import http from '@/api/http'

const groupName = ref('')
const isCreating = ref(false)
const myGroups = ref<any[]>([]) // 前端暂存自己创建的群组

async function handleCreate() {
  if (!groupName.value.trim()) {
    alert('请输入群组名称')
    return
  }
  isCreating.value = true
  try {
    const res = await http.post('/groups', { name: groupName.value })
    // 创建成功后，手动加到本地列表里渲染（无需刷新）
    myGroups.value.unshift(res.data)
    groupName.value = ''
    alert('创建成功！')
  } catch (error: any) {
    alert(error.message || '创建失败')
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <div class="groups-page">
    <h1>我的群组</h1>

    <!-- 创建群组卡片 -->
    <div class="create-card">
      <h3>创建新群组</h3>
      <div class="create-form">
        <input
          v-model="groupName"
          type="text"
          placeholder="输入群组名称（如：xxx小说研讨会）"
          @keyup.enter="handleCreate"
        />
        <button @click="handleCreate" :disabled="isCreating">
          {{ isCreating ? '创建中...' : '创建群组' }}
        </button>
      </div>
    </div>

    <!-- 群组列表 -->
    <div class="group-list">
      <div v-if="myGroups.length === 0" class="empty-state">
        <span>🏠</span>
        <p>你还没有加入或创建任何群组</p>
        <p style="font-size: 13px; color: #999;">在上方创建一个，开始私密协作吧</p>
      </div>

      <div v-else v-for="group in myGroups" :key="group.id" class="group-card">
        <div class="group-info">
          <h4>{{ group.name }}</h4>
          <p>创建于 {{ new Date(group.createdAt).toLocaleDateString() }}</p>
        </div>
        <div class="group-action">
          <span class="badge">群主</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.groups-page {
  max-width: 800px;
  margin: 0 auto;
}
.groups-page h1 {
  font-size: 24px;
  margin-bottom: 24px;
  color: #202124;
}
.create-card {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  margin-bottom: 24px;
}
.create-card h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #202124;
}
.create-form {
  display: flex;
  gap: 12px;
}
.create-form input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #dadce0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}
.create-form input:focus {
  border-color: #1a73e8;
}
.create-form button {
  padding: 10px 24px;
  background: #1a73e8;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
}
.create-form button:disabled {
  background: #a8c7fa;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #5f6368;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.empty-state span { font-size: 48px; display: block; margin-bottom: 16px; }

.group-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 20px 24px;
  border-radius: 12px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: transform 0.2s;
}
.group-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.group-info h4 { margin: 0 0 4px 0; font-size: 16px; color: #202124; }
.group-info p { margin: 0; font-size: 13px; color: #999; }
.badge {
  background: #e8f0fe; color: #1a73e8; padding: 4px 12px;
  border-radius: 12px; font-size: 12px; font-weight: 500;
}
</style>
