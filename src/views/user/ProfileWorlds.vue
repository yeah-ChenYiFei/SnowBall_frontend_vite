<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import type { World } from '@/types'

const route = useRoute()
const router = useRouter()
const userId = computed(() => Number(route.params.userId))

const worlds = ref<World[]>([])
const isLoading = ref(true)
const authorName = ref('')

const typeLabel: Record<string, string> = {
  '奇幻': '奇幻', '科幻': '科幻', '都市': '都市',
  '古风': '古风', '末世': '末世', '架空历史': '架空历史', '其他': '其他',
}

onMounted(async () => {
  try {
    const res = await http.get(`/users/${userId.value}/worlds`)
    worlds.value = res.data || []
  } catch { worlds.value = [] }
  finally { isLoading.value = false }
})

function goWorld(id: number) { router.push(`/wild/worlds/${id}`) }

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('zh-CN')
</script>

<template>
  <div class="profile-worlds-page">
    <button class="back-btn" @click="router.push(`/profile/${userId}`)">← 返回主页</button>
    <h2>公开世界</h2>
    <div v-if="isLoading" class="loading-state">加载中...</div>
    <div v-else-if="worlds.length === 0" class="empty-state">暂无公开世界</div>
    <div v-else class="worlds-grid">
      <div v-for="w in worlds" :key="w.id" class="world-card" @click="goWorld(w.id)">
        <h3 class="world-name">{{ w.name }}</h3>
        <div class="world-type">{{ typeLabel[w.type] || w.type || '未分类' }}</div>
        <p v-if="w.description" class="world-desc">{{ w.description }}</p>
        <div class="world-footer">
          <span>{{ w.entryCount ?? 0 }} 个设定</span>
          <span>{{ formatDate(w.createdAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-worlds-page { max-width: 960px; margin: 0 auto; padding: 24px 20px; }
.back-btn { background: none; border: none; color: #1a73e8; cursor: pointer; font-size: 14px; padding: 4px 0; margin-bottom: 16px; display: inline-block; }
.back-btn:hover { text-decoration: underline; }
h2 { font-size: 20px; font-weight: 600; margin: 0 0 20px; color: #202124; }
.loading-state, .empty-state { text-align: center; padding: 60px; color: #999; font-size: 14px; }
.worlds-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.world-card {
  padding: 20px; border: 1px solid #e8eaed; border-radius: 12px;
  cursor: pointer; transition: all 0.15s; background: #fff;
}
.world-card:hover { border-color: #1a73e8; box-shadow: 0 2px 8px rgba(26,115,232,0.08); }
.world-name { font-size: 16px; font-weight: 600; color: #202124; margin: 0 0 6px; }
.world-type {
  display: inline-block; font-size: 11px; padding: 2px 8px;
  border-radius: 4px; background: #e8f0fe; color: #1a73e8; margin-bottom: 8px;
}
.world-desc {
  font-size: 13px; color: #5f6368; line-height: 1.5; margin: 0 0 12px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.world-footer { display: flex; justify-content: space-between; font-size: 12px; color: #999; }
</style>
