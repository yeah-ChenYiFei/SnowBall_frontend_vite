<!-- src/views/Explore.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import http from '@/api/http'
import type { Post } from '@/types'

const posts = ref<Post[]>([])
const isLoading = ref(false)

// 搜索与筛选条件
const searchQuery = ref('')
const selectedType = ref('')
const selectedTag = ref('')

const typeOptions = [
  { label: '全部类型', value: '' },
  { label: '原创角色', value: 'OC' },
  { label: '世界观设定', value: 'SETTING' },
  { label: '小说片段', value: 'FRAGMENT' },
  { label: '书籍信息', value: 'BOOK_INFO' }
]

const typeMap: Record<string, string> = {
  OC: '原创角色', SETTING: '世界观', FRAGMENT: '小说片段', BOOK_INFO: '书籍信息'
}

// 执行搜索
const performSearch = async () => {
  isLoading.value = true
  try {
    // 拼接查询参数，忽略空值
    const params: any = {}
    if (searchQuery.value.trim()) params.q = searchQuery.value.trim()
    if (selectedType.value) params.type = selectedType.value
    if (selectedTag.value.trim()) params.tag = selectedTag.value.trim()

    const res = await http.get('/search', { params })
    posts.value = res.data || []
  } catch (error) {
    console.error('搜索失败', error)
  } finally {
    isLoading.value = false
  }
}

// 回车触发搜索
const handleEnter = (e: KeyboardEvent) => {
  if (e.key === 'Enter') performSearch()
}

onMounted(() => {
  // 初始加载全部（等同于不带参数的搜索）
  performSearch()
})
</script>

<template>
  <div class="explore-page">
    <h1>🔍 发现与探索</h1>

    <!-- 搜索与筛选区 -->
    <div class="search-bar">
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="搜索标题、正文内容..."
        @keyup="handleEnter"
      />
      <button class="btn-search" @click="performSearch">搜索</button>
    </div>

    <div class="filter-row">
      <select v-model="selectedType" class="filter-select" @change="performSearch">
        <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>

      <input
        v-model="selectedTag"
        type="text"
        class="filter-tag-input"
        placeholder="按标签筛选 (如: 奇幻)"
        @keyup="handleEnter"
      />

      <button
        v-if="searchQuery || selectedType || selectedTag"
        class="btn-clear"
        @click="searchQuery=''; selectedType=''; selectedTag=''; performSearch()"
      >
        清空条件
      </button>
    </div>

    <div v-if="isLoading" class="loading">搜索中...</div>

    <!-- 搜索结果列表 -->
    <div v-else class="search-results">
      <p class="result-count" v-if="posts.length > 0">找到 {{ posts.length }} 条相关内容</p>

      <div v-if="posts.length === 0" class="empty-state">
        没有找到匹配的内容，换个关键词试试？
      </div>

      <!-- 复用首页的卡片风格 -->
      <router-link
        v-for="post in posts"
        :key="post.id"
        :to="`/post/${post.id}`"
        class="result-card"
      >
        <div class="card-header">
          <span class="type-badge">{{ typeMap[post.type] || post.type }}</span>
          <span class="post-time">{{ new Date(post.createdAt).toLocaleDateString() }}</span>
        </div>
        <h3 class="card-title">{{ post.title }}</h3>
        <p class="card-body">{{ post.body?.substring(0, 120) }}...</p>
        <div class="card-footer">
          <span class="author">👤 {{ post.authorName || '匿名' }}</span>
          <div v-if="post.tags && post.tags.length > 0" class="card-tags">
            <span v-for="tag in post.tags" :key="tag" class="mini-tag">#{{ tag }}</span>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.explore-page { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
.explore-page h1 { margin-bottom: 24px; color: #202124; }

.search-bar { display: flex; gap: 12px; margin-bottom: 16px; }
.search-input {
  flex: 1; padding: 12px 16px; font-size: 16px; border: 2px solid #e8eaed;
  border-radius: 8px; outline: none; transition: border-color 0.2s;
}
.search-input:focus { border-color: #1a73e8; }
.btn-search {
  padding: 0 32px; background: #1a73e8; color: white; border: none;
  border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 500;
}
.btn-search:hover { background: #1557b0; }

.filter-row { display: flex; gap: 12px; align-items: center; margin-bottom: 24px; }
.filter-select {
  padding: 8px 12px; border: 1px solid #dadce0; border-radius: 6px; font-size: 14px; outline: none;
}
.filter-tag-input {
  padding: 8px 12px; border: 1px solid #dadce0; border-radius: 6px; font-size: 14px; outline: none; width: 200px;
}
.filter-tag-input:focus, .filter-select:focus { border-color: #1a73e8; }
.btn-clear { background: none; border: none; color: #d93025; font-size: 14px; cursor: pointer; text-decoration: underline; }

.loading { text-align: center; padding: 40px; color: #666; }
.result-count { font-size: 14px; color: #5f6368; margin-bottom: 16px; }
.empty-state { text-align: center; padding: 60px 20px; color: #999; background: #fff; border-radius: 8px; }

.search-results { display: flex; flex-direction: column; gap: 16px; }
.result-card {
  background: #fff; padding: 20px 24px; border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); text-decoration: none; color: inherit;
  display: block; transition: transform 0.2s, box-shadow 0.2s;
}
.result-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.type-badge { font-size: 12px; padding: 2px 8px; border-radius: 4px; background: #e8f0fe; color: #1a73e8; }
.post-time { font-size: 13px; color: #999; }
.card-title { font-size: 18px; font-weight: 600; margin: 0 0 8px 0; color: #202124; }
.card-body { font-size: 14px; color: #5f6368; line-height: 1.5; margin: 0 0 12px 0; }
.card-footer { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #999; }
.author { margin-right: 16px; }
.card-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.mini-tag { font-size: 12px; color: #1a73e8; }
</style>
