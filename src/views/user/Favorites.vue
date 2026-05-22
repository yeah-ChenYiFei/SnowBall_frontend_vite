<script setup lang="ts">
import { ref, onMounted } from 'vue'
import http from '@/api/http'
import PostCard from '@/components/PostCard.vue'
import type { Post } from '@/types'

const posts = ref<Post[]>([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    const res = await http.get<Post[]>('/posts/favorites')
    posts.value = res.data ?? []
  } catch { /* */ }
  finally { isLoading.value = false }
})
</script>

<template>
  <div class="favorites-page">
    <h2>我的收藏</h2>
    <div v-if="isLoading" class="loading-state">加载中...</div>
    <div v-else-if="posts.length === 0" class="empty-state">还没有收藏任何帖子</div>
    <div v-else class="post-feed">
      <div v-for="(post, idx) in posts" :key="post.id" class="staggered-card">
        <PostCard :post="post" :image-position="idx % 2 === 0 ? 'left' : 'right'" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.favorites-page { max-width: 960px; margin: 0 auto; }
h2 { font-size: 20px; font-weight: 500; margin-bottom: 24px; color: #202124; }
.loading-state, .empty-state { text-align: center; padding: 40px; color: #999; font-size: 14px; }
.post-feed { display: flex; flex-direction: column; gap: 16px; }
</style>
