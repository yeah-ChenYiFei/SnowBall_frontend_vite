<!-- src/views/user/Mine.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import type { UserProfileVO } from '@/types'

const router = useRouter()
const userStore = useUserStore()

const profileData = ref<UserProfileVO | null>(null)
const isLoading = ref(true)

const loadData = async () => {
  try {
    // ✅ 核心修复：严格按照后端现有接口，传入当前用户的 ID
    const userId = userStore.userInfo?.id
    if (!userId) {
      console.error('无法获取当前用户 ID，请检查登录逻辑是否存入了 ID')
      return
    }

    // 调用后端真实的聚合接口：/api/v1/users/{id}/profile
    const res = await http.get<UserProfileVO>(`/users/${userId}/profile`)
    profileData.value = res.data
  } catch (error: any) {
    console.error('加载个人主页失败', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  if (!userStore.isLogin()) {
    router.push('/login')
    return
  }
  await userStore.waitReady()

  loadData()
})
</script>

<template>
  <div class="mine-page">
    <h1>个人中心</h1>

    <div v-if="isLoading" class="loading">加载中...</div>

    <template v-else-if="profileData">
      <!-- 个人信息卡片：直接用聚合接口返回的 user 对象 -->
      <div class="profile-card">
        <div class="avatar">{{ profileData.user.username?.charAt(0)?.toUpperCase() || 'U' }}</div>
        <div class="user-info">
          <h2>{{ profileData.user.username }}</h2>
          <p class="role-badge">角色：{{ userStore.userInfo?.role || 'USER' }}</p>
        </div>
      </div>

      <!-- 快捷功能入口 -->
      <div class="shortcuts-grid">
        <div class="shortcut-card" @click="router.push('/books')">
          <span class="icon">📚</span>
          <span class="label">图书管理</span>
          <span class="desc">管理你的实体书单</span>
        </div>
        <div class="shortcut-card" @click="router.push('/groups')">
          <span class="icon">👥</span>
          <span class="label">我的群组</span>
          <span class="desc">私密协作空间</span>
        </div>
        <div class="shortcut-card" @click="router.push('/create')">
          <span class="icon">✍️</span>
          <span class="label">发布内容</span>
          <span class="desc">创作新作品</span>
        </div>
      </div>

      <!-- 我的最近发布：直接用聚合接口返回的 posts 数组 -->
      <div class="section-box">
        <div class="section-header">
          <h3>我的最近发布</h3>
        </div>
        <div v-if="profileData.posts.length === 0" class="empty-section">还没有发布过内容</div>
        <ul v-else class="simple-list">
          <li v-for="post in profileData.posts" :key="post.id">
            <router-link :to="`/post/${post.id}`">{{ post.title }}</router-link>
            <span class="time">{{ new Date(post.createdAt).toLocaleDateString() }}</span>
          </li>
        </ul>
      </div>

      <!-- 我的藏书：直接用聚合接口返回的 books 数组 -->
      <div class="section-box">
        <div class="section-header">
          <h3>我的藏书</h3>
          <router-link to="/books" class="view-all">管理图书 →</router-link>
        </div>
        <div v-if="profileData.books.length === 0" class="empty-section">还没有记录图书</div>
        <ul v-else class="simple-list">
          <li v-for="book in profileData.books" :key="book.id">
            <span>📖 {{ book.title }} <span style="color:#999">- {{ book.author }}</span></span>
            <span class="time">¥{{ book.price.toFixed(2) }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 这里的样式和之前完全一样，不需要改动，我只省略掉以节省篇幅，你保留原来的 style 即可 */
.mine-page { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
.mine-page h1 { margin-bottom: 24px; color: #202124; }
.loading { text-align: center; padding: 40px; color: #666; }
.profile-card { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); display: flex; gap: 20px; align-items: center; margin-bottom: 24px; }
.avatar { width: 64px; height: 64px; border-radius: 50%; background: #1a73e8; color: white; font-size: 28px; font-weight: 600; display: flex; justify-content: center; align-items: center; flex-shrink: 0; }
.user-info h2 { margin: 0 0 4px 0; color: #202124; font-size: 20px; }
.role-badge { margin: 0; font-size: 13px; color: #1a73e8; background: #e8f0fe; display: inline-block; padding: 2px 8px; border-radius: 4px; }
.shortcuts-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
.shortcut-card { background: #fff; padding: 20px; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; text-align: center; border: 1px solid #f0f0f0; }
.shortcut-card:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: #d2e3fc; }
.shortcut-card .icon { font-size: 32px; display: block; margin-bottom: 8px; }
.shortcut-card .label { font-size: 15px; font-weight: 600; color: #202124; display: block; margin-bottom: 4px; }
.shortcut-card .desc { font-size: 12px; color: #999; display: block; }
.section-box { background: #fff; padding: 20px; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); margin-bottom: 16px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #f0f0f0; padding-bottom: 12px; }
.section-header h3 { margin: 0; font-size: 16px; color: #202124; }
.view-all { font-size: 13px; color: #1a73e8; text-decoration: none; }
.empty-section { text-align: center; padding: 24px; color: #999; font-size: 14px; }
.simple-list { list-style: none; padding: 0; margin: 0; }
.simple-list li { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f8f8f8; font-size: 14px; }
.simple-list li:last-child { border-bottom: none; }
.simple-list a { color: #333; text-decoration: none; font-weight: 500; }
.simple-list a:hover { color: #1a73e8; }
.simple-list .time { color: #999; font-size: 13px; }
@media (max-width: 768px) { .shortcuts-grid { grid-template-columns: 1fr; } }
</style>
