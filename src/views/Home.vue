<!-- src/views/Home.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import http from '@/api/http'
import type { Post, StoryChain } from '@/types'

const activeTab = ref<'post' | 'chain'>('post')
const posts = ref<Post[]>([])
const chains = ref<StoryChain[]>([])
const isLoading = ref(false)

// 加载帖子列表
const loadPosts = async () => {
  isLoading.value = true
  try {
    const res = await http.get('/posts')
    posts.value = res.data || []
  } catch (error) {
    console.error('加载帖子失败', error)
  } finally {
    isLoading.value = false
  }
}

// 加载接龙列表
const loadChains = async () => {
  isLoading.value = true
  try {
    const res = await http.get('/chains')
    chains.value = res.data || []
  } catch (error) {
    console.error('加载接龙失败', error)
  } finally {
    isLoading.value = false
  }
}

// 类型映射
const typeMap: Record<string, string> = {
  OC: '原创角色',
  SETTING: '世界观',
  FRAGMENT: '小说片段',
  BOOK_INFO: '书籍信息'
}

onMounted(() => {
  loadPosts()
})
</script>

<template>
  <div class="home-page">
    <!-- Tab 切换 -->
    <div class="tab-bar">
      <button
        :class="['tab-btn', { active: activeTab === 'post' }]"
        @click="activeTab = 'post'; loadPosts()"
      >
        广场帖子
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'chain' }]"
        @click="activeTab = 'chain'; loadChains()"
      >
        故事接龙
      </button>
    </div>

    <div v-if="isLoading" class="loading">加载中...</div>

    <!-- 帖子列表 -->
    <div v-else-if="activeTab === 'post'" class="card-list">
      <div v-if="posts.length === 0" class="empty-state">还没有人发布内容，快来创作第一篇吧！</div>

      <router-link
        v-for="post in posts"
        :key="post.id"
        :to="`/post/${post.id}`"
        class="post-card"
      >
        <div class="card-header">
          <span class="type-badge">{{ typeMap[post.type] || post.type }}</span>
          <span class="post-time">{{ new Date(post.createdAt).toLocaleDateString() }}</span>
        </div>
        <h3 class="card-title">{{ post.title }}</h3>
        <p class="card-body">{{ post.body?.substring(0, 100) }}...</p>
        <div class="card-footer">
          <span class="author">👤 {{ post.authorName || '匿名' }}</span>
          <span class="stats">💬 {{ post.commentCount || 0 }}</span>
        </div>
        <!-- 标签展示 -->
        <div v-if="post.tags && post.tags.length > 0" class="card-tags">
          <span v-for="tag in post.tags" :key="tag" class="mini-tag">#{{ tag }}</span>
        </div>
      </router-link>
    </div>

    <!-- 接龙列表 -->
    <div v-else class="card-list">
        <!-- ✅ 新增：发起接龙按钮 -->
      <div class="create-chain-bar">
        <button class="btn-create-chain" @click="$router.push('/create?mode=chain')">
          ✨ 发起新接龙
        </button>
      </div>
      <div v-if="chains.length === 0" class="empty-state">还没有接龙故事，发起第一个吧！</div>

      <router-link
        v-for="chain in chains"
        :key="chain.id"
        :to="`/chain/${chain.id}`"
        class="post-card"
      >
        <div class="card-header">
          <span class="type-badge chain-badge">接龙</span>
          <span class="post-time">{{ new Date(chain.createdAt).toLocaleDateString() }}</span>
        </div>
        <h3 class="card-title">{{ chain.title }}</h3>
        <p class="card-body">{{ chain.firstSegmentBody?.substring(0, 100) || '点击查看故事...' }}</p>
        <div class="card-footer">
          <span class="author">👤 {{ chain.creatorName || '匿名' }}</span>
        </div>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.create-chain-bar { margin-bottom: 16px; }
.btn-create-chain {
  width: 100%; padding: 14px; background: #fce8e6; color: #d93025;
  border: 1px dashed #f28b82; border-radius: 8px; font-size: 15px;
  cursor: pointer; font-weight: 500; transition: all 0.2s;
}
.btn-create-chain:hover { background: #f28b82; color: white; border-style: solid; }
.home-page { max-width: 900px; margin: 0 auto; }
.tab-bar { display: flex; gap: 16px; margin-bottom: 24px; border-bottom: 2px solid #e8eaed; }
.tab-btn {
  padding: 12px 20px; background: none; border: none; font-size: 16px;
  color: #5f6368; cursor: pointer; border-bottom: 2px solid transparent;
  margin-bottom: -2px; font-weight: 500; transition: all 0.2s;
}
.tab-btn.active { color: #1a73e8; border-bottom-color: #1a73e8; }
.loading { text-align: center; padding: 40px; color: #5f6368; }
.empty-state { text-align: center; padding: 60px 20px; color: #999; background: #fff; border-radius: 8px; }

.card-list { display: flex; flex-direction: column; gap: 16px; }
.post-card {
  background: #fff; padding: 20px 24px; border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); text-decoration: none; color: inherit;
  display: block; transition: transform 0.2s, box-shadow 0.2s;
}
.post-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.type-badge {
  font-size: 12px; padding: 2px 8px; border-radius: 4px;
  background: #e8f0fe; color: #1a73e8;
}
.chain-badge { background: #fce8e6; color: #d93025; }
.post-time { font-size: 13px; color: #999; }
.card-title { font-size: 18px; font-weight: 600; margin: 0 0 8px 0; color: #202124; }
.card-body { font-size: 14px; color: #5f6368; line-height: 1.5; margin: 0 0 12px 0; }
.card-footer { display: flex; gap: 16px; font-size: 13px; color: #999; }
.card-tags { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
.mini-tag { font-size: 12px; color: #1a73e8; }
</style>
