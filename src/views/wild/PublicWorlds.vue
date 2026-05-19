<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import type { PublicWorld } from '@/types'

const router = useRouter()
const worlds = ref<PublicWorld[]>([])
const isLoading = ref(false)

async function loadWorlds() {
  isLoading.value = true
  try {
    const res = await http.get<PublicWorld[]>('/worlds/public')
    worlds.value = res.data || []
  } catch { /* */ }
  finally { isLoading.value = false }
}

function goToWorld(id: number) {
  router.push(`/wild/worlds/${id}`)
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('zh-CN')

onMounted(loadWorlds)
</script>

<template>
  <div class="worlds-page">
    <div class="page-header">
      <h2 class="page-title">大世界</h2>
      <span class="page-subtitle">公开的世界设定，探索他人创作的宇宙</span>
    </div>

    <div v-if="isLoading" class="loading-state">加载中...</div>

    <div v-else-if="worlds.length === 0" class="empty-state">
      <div class="empty-icon">🌍</div>
      <div class="empty-text">还没有公开的世界，去创建并公开你的世界吧</div>
    </div>

    <div v-else class="worlds-grid">
      <article
        v-for="w in worlds"
        :key="w.id"
        class="world-card"
        @click="goToWorld(w.id)"
      >
        <div class="card-top">
          <span class="world-type">{{ w.type }}</span>
          <span class="world-entries">{{ w.entryCount }} 条目</span>
        </div>
        <h3 class="world-name">{{ w.name }}</h3>
        <p v-if="w.description" class="world-desc">{{ w.description }}</p>
        <div class="card-footer">
          <span class="world-date">{{ formatDate(w.createdAt) }}</span>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.worlds-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 24px;
}
.page-header { margin-bottom: 24px; }
.page-title { font-size: 22px; font-weight: 700; color: #202124; margin: 0; }
.page-subtitle { font-size: 13px; color: #999; display: block; margin-top: 4px; }

.loading-state { text-align: center; padding: 60px; color: #999; }
.empty-state { text-align: center; padding: 60px 20px; color: #999; }
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.empty-text { font-size: 14px; }

.worlds-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.world-card {
  background: #fff; border-radius: 14px; padding: 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05); border: 1px solid #f1f3f4;
  cursor: pointer; transition: all 0.2s;
}
.world-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1); border-color: #d2e3fc;
}
.card-top { display: flex; justify-content: space-between; margin-bottom: 12px; }
.world-type {
  font-size: 12px; padding: 3px 10px; background: #e8f0fe;
  color: #1a73e8; border-radius: 4px; font-weight: 500;
}
.world-entries { font-size: 13px; color: #999; }
.world-name { font-size: 18px; font-weight: 600; color: #202124; margin: 0 0 8px 0; }
.world-desc {
  font-size: 13px; color: #5f6368; margin: 0 0 16px 0;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.card-footer { font-size: 12px; color: #999; }

@media (max-width: 860px) {
  .worlds-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 540px) {
  .worlds-grid { grid-template-columns: 1fr; }
}
</style>
