<script setup lang="ts">
import { ref, onMounted } from 'vue'
import http from '@/api/http'
import AdminNav from '@/components/AdminNav.vue'

const stats = ref<Record<string, number>>({})

onMounted(async () => {
  const res = await http.get<Record<string, number>>('/admin/stats')
  stats.value = res.data ?? {}
})

const cards = [
  { key: 'users', label: '用户', icon: '👤' },
  { key: 'posts', label: '帖子', icon: '📝' },
  { key: 'articles', label: '文章', icon: '📄' },
  { key: 'worlds', label: '世界', icon: '🌍' },
  { key: 'chains', label: '接龙', icon: '🔗' },
  { key: 'groups', label: '群组', icon: '👥' },
  { key: 'comments', label: '评论', icon: '💬' },
]

</script>

<template>
  <div class="dashboard">
    <h2>系统概览</h2>
    <AdminNav />
    <div class="stats-grid">
      <div v-for="c in cards" :key="c.key" class="stat-card">
        <span class="stat-icon">{{ c.icon }}</span>
        <div class="stat-num">{{ stats[c.key] ?? '-' }}</div>
        <div class="stat-label">{{ c.label }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard { max-width: 960px; margin: 0 auto; }
h2 { font-size: 20px; font-weight: 500; margin-bottom: 24px; color: #202124; }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.stat-card {
  background: #fff; border-radius: 12px; padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e8eaed;
  text-align: center;
}
.stat-icon { font-size: 28px; }
.stat-num { font-size: 32px; font-weight: 600; color: #1a73e8; margin: 8px 0 4px; }
.stat-label { font-size: 13px; color: #5f6368; }
</style>
