<!-- src/views/Explore.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import http from '@/api/http'
import PostCard from '@/components/PostCard.vue'
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

      <!-- 搜索结果卡片 -->
      <div class="post-grid">
        <div v-for="(post, idx) in posts" :key="post.id" class="staggered-card">
          <PostCard :post="post" :image-position="idx % 2 === 0 ? 'left' : 'right'" />
        </div>
      </div>
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

.search-results { }
.post-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.staggered-card:nth-child(even) { margin-top: 60px; }
@media (max-width: 700px) {
  .post-grid { grid-template-columns: 1fr; }
  .staggered-card:nth-child(even) { margin-top: 0; }
}
</style>
