<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import PostCard from '@/components/PostCard.vue'
import type { Post, NovelCard, PublicWorld } from '@/types'

const router = useRouter()
const activeTab = ref<'posts' | 'novels' | 'worlds'>('posts')

const posts = ref<Post[]>([])
const novels = ref<NovelCard[]>([])
const worlds = ref<PublicWorld[]>([])
const isLoading = ref(true)
const isLoadingNovels = ref(false)
const isLoadingWorlds = ref(false)

onMounted(async () => {
  try {
    const res = await http.get<Post[]>('/posts/favorites')
    posts.value = res.data ?? []
  } catch { /* */ }
  finally { isLoading.value = false }
})

async function loadFavoriteNovels() {
  isLoadingNovels.value = true
  try {
    const res = await http.get<NovelCard[]>('/novels/favorites')
    novels.value = res.data || []
  } catch { novels.value = [] }
  finally { isLoadingNovels.value = false }
}

async function loadFavoriteWorlds() {
  isLoadingWorlds.value = true
  try {
    const res = await http.get<PublicWorld[]>('/worlds/favorites')
    worlds.value = res.data || []
  } catch { worlds.value = [] }
  finally { isLoadingWorlds.value = false }
}

watch(activeTab, (tab) => {
  if (tab === 'novels' && novels.value.length === 0 && !isLoadingNovels.value) loadFavoriteNovels()
  if (tab === 'worlds' && worlds.value.length === 0 && !isLoadingWorlds.value) loadFavoriteWorlds()
})

function goNovel(id: number) { router.push(`/wild/library/novel/${id}`) }
function goWorld(id: number) { router.push(`/wild/worlds/${id}`) }

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('zh-CN')
</script>

<template>
  <div class="favorites-page">
    <h2>我的收藏</h2>

    <div class="fav-tabs">
      <button :class="['fav-tab', { active: activeTab === 'posts' }]" @click="activeTab = 'posts'">
        📝 帖子
      </button>
      <button :class="['fav-tab', { active: activeTab === 'novels' }]" @click="activeTab = 'novels'">
        📖 小说
      </button>
      <button :class="['fav-tab', { active: activeTab === 'worlds' }]" @click="activeTab = 'worlds'">
        🌍 世界
      </button>
    </div>

    <!-- Posts Tab -->
    <div v-if="activeTab === 'posts'">
      <div v-if="isLoading" class="loading-state">加载中...</div>
      <div v-else-if="posts.length === 0" class="empty-state">还没有收藏任何帖子</div>
      <div v-else class="post-feed">
        <div v-for="(post, idx) in posts" :key="post.id" class="staggered-card">
          <PostCard :post="post" :image-position="idx % 2 === 0 ? 'left' : 'right'" />
        </div>
      </div>
    </div>

    <!-- Novels Tab -->
    <div v-else-if="activeTab === 'novels'">
      <div v-if="isLoadingNovels" class="loading-state">加载中...</div>
      <div v-else-if="novels.length === 0" class="empty-state">还没有收藏任何小说</div>
      <div v-else class="novels-grid">
        <div v-for="n in novels" :key="n.id" class="novel-card" @click="goNovel(n.id)">
          <h3 class="novel-title">{{ n.title }}</h3>
          <p v-if="n.description" class="novel-desc">{{ n.description }}</p>
          <div class="novel-footer">
            <span>{{ n.authorName || '匿名' }}</span>
            <span v-if="n.totalWordCount">{{ n.totalWordCount.toLocaleString() }} 字</span>
            <span>{{ formatDate(n.createdAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Worlds Tab -->
    <div v-else-if="activeTab === 'worlds'">
      <div v-if="isLoadingWorlds" class="loading-state">加载中...</div>
      <div v-else-if="worlds.length === 0" class="empty-state">还没有收藏任何世界</div>
      <div v-else class="worlds-grid">
        <div v-for="w in worlds" :key="w.id" class="world-card" @click="goWorld(w.id)">
          <h3 class="world-name">{{ w.name }}</h3>
          <p v-if="w.description" class="world-desc">{{ w.description }}</p>
          <div class="world-footer">
            <span>{{ w.entryCount ?? 0 }} 个设定</span>
            <span>{{ formatDate(w.createdAt) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.favorites-page { max-width: 960px; margin: 0 auto; padding: 24px 20px; }
h2 { font-size: 20px; font-weight: 600; margin: 0 0 20px; color: #202124; }
.loading-state, .empty-state { text-align: center; padding: 40px; color: #999; font-size: 14px; }
.post-feed { display: flex; flex-direction: column; gap: 16px; }

/* Tabs */
.fav-tabs {
  display: flex; gap: 0; margin-bottom: 24px;
  border-bottom: 1px solid #e8eaed;
}
.fav-tab {
  padding: 10px 20px; background: none; border: none;
  border-bottom: 2px solid transparent; font-size: 14px; color: #5f6368;
  cursor: pointer; font-family: inherit; transition: all 0.15s;
}
.fav-tab.active { color: #d97706; border-bottom-color: #d97706; font-weight: 600; }
.fav-tab:hover:not(.active) { color: #202124; }

/* Novels Grid */
.novels-grid, .worlds-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;
}
.novel-card, .world-card {
  padding: 20px; border: 1px solid #e8eaed; border-radius: 12px;
  cursor: pointer; transition: all 0.15s; background: #fff;
}
.novel-card:hover, .world-card:hover {
  border-color: #d97706; box-shadow: 0 2px 8px rgba(217,119,6,0.08);
}
.novel-title, .world-name { font-size: 16px; font-weight: 600; color: #202124; margin: 0 0 6px; }
.novel-desc, .world-desc {
  font-size: 13px; color: #5f6368; line-height: 1.5; margin: 0 0 12px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.novel-footer, .world-footer {
  display: flex; justify-content: space-between; font-size: 12px; color: #999;
}
</style>
