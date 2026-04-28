<script setup lang="ts">
import { useUserStore } from './stores/user'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const router = useRouter()

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
}
</script>

<template>
  <!-- 雪球平台导航栏 -->
  <header class="snowball-header">
    <div class="header-content">
      <!-- 品牌标识 -->
      <div class="brand">
        <span class="brand-icon">❄️</span>
        <router-link to="/" class="brand-name">雪球</router-link>
        <span class="brand-slogan">故事如雪球越滚越大</span>
      </div>

      <!-- 主导航 -->
      <nav class="main-nav">
        <router-link to="/" class="nav-link">广场</router-link>
        <router-link to="/explore" class="nav-link">发现</router-link>

        <template v-if="userStore.isLogin()">
          <router-link to="/create" class="nav-link">创作</router-link>
          <router-link to="/groups" class="nav-link">群组</router-link>
          <router-link to="/mine" class="nav-link">
            我的 ({{ userStore.userInfo.name }})
          </router-link>
        </template>
      </nav>

      <!-- 用户操作区 -->
      <div class="user-actions">
        <template v-if="!userStore.isLogin()">
          <router-link to="/login" class="btn-login">登录</router-link>
          <router-link to="/register" class="btn-register">注册</router-link>
        </template>
        <template v-else>
          <button @click="handleLogout" class="btn-logout">退出</button>
        </template>
      </div>
    </div>
  </header>

  <!-- 页面内容 -->
  <main class="page-content">
    <router-view />
  </main>
</template>

<style scoped>
/* 雪球设计规范：白色与微蓝极简风格 */
.snowball-header {
  background: #ffffff;
  border-bottom: 1px solid #e8f0fe;
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.08);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* 品牌区域 */
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  font-size: 24px;
}

.brand-name {
  font-size: 20px;
  font-weight: 600;
  color: #1a73e8;
  text-decoration: none;
}

.brand-slogan {
  font-size: 12px;
  color: #5f6368;
  margin-left: 8px;
}

/* 导航链接 */
.main-nav {
  display: flex;
  gap: 24px;
}

.nav-link {
  color: #5f6368;
  text-decoration: none;
  font-size: 15px;
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.nav-link:hover {
  color: #1a73e8;
  background: #e8f0fe;
}

.nav-link.router-link-active {
  color: #1a73e8;
  background: #e8f0fe;
  font-weight: 500;
}

/* 用户操作按钮 */
.user-actions {
  display: flex;
  gap: 12px;
}

.btn-login {
  padding: 8px 20px;
  border: 1px solid #1a73e8;
  color: #1a73e8;
  border-radius: 6px;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s ease;
}

.btn-login:hover {
  background: #e8f0fe;
}

.btn-register {
  padding: 8px 20px;
  background: #1a73e8;
  color: white;
  border-radius: 6px;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s ease;
}

.btn-register:hover {
  background: #1557b0;
}

.btn-logout {
  padding: 8px 16px;
  border: 1px solid #dadce0;
  background: white;
  color: #5f6368;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-logout:hover {
  background: #f8f9fa;
  border-color: #dadce0;
}

/* 页面内容区 */
.page-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
  min-height: calc(100vh - 64px);
  background: #f8f9fa;
}
</style>
