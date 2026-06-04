<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import PostCard from '@/components/PostCard.vue'
import type { Post } from '@/types'

const route = useRoute()
const router = useRouter()
const userId = computed(() => Number(route.params.userId))

const posts = ref<Post[]>([])
const isLoading = ref(true)
const authorName = ref('')

onMounted(async () => {
  try {
    const res = await http.get(`/users/${userId.value}/posts`)
    posts.value = (res.data as any[]) || []
    if (posts.value.length > 0) authorName.value = posts.value[0]?.authorName || ''
  } catch { posts.value = [] }
  finally { isLoading.value = false }
})
</script>

<template>
  <div class="profile-posts-page">
    <button class="back-btn" @click="router.push(`/profile/${userId}`)">← 返回主页</button>
    <h2>{{ authorName ? `${authorName} 的帖子` : '公开帖子' }}</h2>
    <div v-if="isLoading" class="loading-state">加载中...</div>
    <div v-else-if="posts.length === 0" class="empty-state">暂无公开帖子</div>
    <div v-else class="post-feed">
      <div v-for="(post, idx) in posts" :key="post.id" class="feed-card">
        <PostCard :post="post" :image-position="idx % 2 === 0 ? 'left' : 'right'" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-posts-page { max-width: 960px; margin: 0 auto; padding: 24px 20px; }
.back-btn { background: none; border: none; color: #1a73e8; cursor: pointer; font-size: 14px; padding: 4px 0; margin-bottom: 16px; display: inline-block; }
.back-btn:hover { text-decoration: underline; }
h2 { font-size: 20px; font-weight: 600; margin: 0 0 20px; color: #202124; }
.loading-state, .empty-state { text-align: center; padding: 60px; color: #999; font-size: 14px; }
.post-feed { display: flex; flex-direction: column; gap: 16px; }
</style>
