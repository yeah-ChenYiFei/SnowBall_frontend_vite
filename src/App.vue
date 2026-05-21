<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from './stores/user'
import { useRouter, useRoute } from 'vue-router'
import http from '@/api/http'

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

const isAuthPage = computed(() => route.path === '/login' || route.path === '/register')

const showWildMenu = ref(false)
const showCreateMenu = ref(false)
const showMyMenu = ref(false)
let wildHideTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let hideMyTimer: ReturnType<typeof setTimeout> | null = null
const unreadCount = ref(0)
const friendUnread = ref(0)
let pollTimer: ReturnType<typeof setInterval> | null = null

const fetchUnreadCount = async () => {
  if (!userStore.isLogin()) return
  try {
    const res = await http.get('/notifications/unread-count')
    unreadCount.value = res.data ?? 0
  } catch (e) {
    // ignore
  }
}

onMounted(() => {
  if (userStore.isLogin()) {
    fetchUnreadCount()
    fetchFriendUnread()
  }
  pollTimer = setInterval(() => {
    if (userStore.isLogin()) {
      fetchUnreadCount()
      fetchFriendUnread()
    }
  }, 30000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})

const wildSubItems = [
  { label: '广场', path: '/', desc: '零散想法与帖子' },
  { label: '接龙', path: '/wild/chains', desc: '公共故事接龙' },
  { label: '大世界', path: '/wild/worlds', desc: '公开世界设定' },
  { label: '文阁', path: '/wild/library', desc: '已发布的小说散文' },
]

const createSubItems = [
  { label: '设定编写', path: '/create/setting', desc: '世界观与角色设定' },
  { label: '灵感记录', path: '/create/inspiration', desc: '捕捉创作灵感' },
  { label: '创作中心', path: '/writing', desc: '写作工作台' },
]

function openWildMenu() {
  if (wildHideTimer) { clearTimeout(wildHideTimer); wildHideTimer = null }
  showWildMenu.value = true
}
function scheduleHideWild() {
  wildHideTimer = setTimeout(() => { showWildMenu.value = false }, 350)
}
function scheduleHide() {
  hideTimer = setTimeout(() => { showCreateMenu.value = false }, 350)
}
function scheduleHideMy() {
  hideMyTimer = setTimeout(() => { showMyMenu.value = false }, 350)
}
function openCreateMenu() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  showCreateMenu.value = true
}

function openMyMenu() {
  if (hideMyTimer) { clearTimeout(hideMyTimer); hideMyTimer = null }
  showMyMenu.value = true
}

const fetchFriendUnread = async () => {
  if (!userStore.isLogin()) return
  // Backend endpoint pending — silently set 0 for now
  friendUnread.value = 0
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<template>
  <template v-if="isAuthPage">
    <router-view />
  </template>
  <template v-else>
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
        <div
          v-if="route.path !== '/login' && route.path !== '/register'"
          class="nav-dropdown nav-link nav-link-dropdown"
          :class="{ 'is-active': showWildMenu }"
          @mouseenter="openWildMenu"
          @mouseleave="scheduleHideWild"
        >
          旷野
          <span class="arrow" :class="{ 'arrow-open': showWildMenu }">▾</span>
          <transition name="dropdown">
            <div v-if="showWildMenu" class="dropdown-panel"
                 @mouseenter="openWildMenu"
                 @mouseleave="scheduleHideWild">
              <router-link
                v-for="item in wildSubItems"
                :key="item.path"
                :to="item.path"
                class="dropdown-item"
                :class="{ 'item-soon': item.soon }"
                @click="showWildMenu = false"
              >
                <span class="item-label">
                  {{ item.label }}
                  <span v-if="item.soon" class="soon-tag">即将开放</span>
                </span>
                <span class="item-desc">{{ item.desc }}</span>
              </router-link>
            </div>
          </transition>
        </div>

        <template v-if="userStore.isLogin()">
          <div
            class="nav-dropdown nav-link nav-link-dropdown"
            :class="{ 'is-active': showCreateMenu }"
            @mouseenter="openCreateMenu"
            @mouseleave="scheduleHide"
          >
            创作
            <span class="arrow" :class="{ 'arrow-open': showCreateMenu }">▾</span>
            <transition name="dropdown">
              <div v-if="showCreateMenu" class="dropdown-panel"
                   @mouseenter="openCreateMenu"
                   @mouseleave="scheduleHide">
                <router-link
                  v-for="item in createSubItems"
                  :key="item.path"
                  :to="item.path"
                  class="dropdown-item"
                  @click="showCreateMenu = false"
                >
                  <span class="item-label">{{ item.label }}</span>
                  <span class="item-desc">{{ item.desc }}</span>
                </router-link>
              </div>
            </transition>
          </div>
          <router-link to="/groups" class="nav-link">群组</router-link>
          <div
            class="nav-dropdown nav-link nav-link-dropdown"
            :class="{ 'is-active': showMyMenu }"
            @mouseenter="openMyMenu"
            @mouseleave="scheduleHideMy"
          >
            我的 ({{ userStore.userInfo?.username || '' }})
            <span class="arrow" :class="{ 'arrow-open': showMyMenu }">▾</span>
            <transition name="dropdown">
              <div v-if="showMyMenu" class="dropdown-panel"
                   @mouseenter="openMyMenu"
                   @mouseleave="scheduleHideMy">
                <router-link to="/profile/self" class="dropdown-item" @click="showMyMenu = false">
                  <span class="item-label">个人主页</span>
                  <span class="item-desc">查看个人资料与动态</span>
                </router-link>
                <router-link to="/books" class="dropdown-item" @click="showMyMenu = false">
                  <span class="item-label">我的藏书</span>
                  <span class="item-desc">管理实体书收藏</span>
                </router-link>
                <router-link to="/friends" class="dropdown-item" @click="showMyMenu = false">
                  <span class="item-label">我的好友</span>
                  <span class="item-desc">好友列表与私聊</span>
                  <span v-if="friendUnread > 0" class="dropdown-badge">{{ friendUnread > 99 ? '99+' : friendUnread }}</span>
                </router-link>
              </div>
            </transition>
          </div>
        </template>
      </nav>

      <!-- 用户操作区 -->
      <div class="user-actions">
        <template v-if="!userStore.isLogin()">
          <router-link to="/login" class="btn-login">登录</router-link>
          <router-link to="/register" class="btn-register">注册</router-link>
        </template>
        <template v-else>
          <router-link to="/notifications" class="btn-notify">
            🔔
            <span v-if="unreadCount > 0" class="badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
          </router-link>
          <button @click="handleLogout" class="btn-logout">退出登录</button>
        </template>
      </div>
    </div>
  </header>

  <!-- 页面内容 -->
  <main class="page-content">
    <router-view />
  </main>
  </template>
</template>

<style scoped>
/* 雪球设计规范：玻璃拟态 + 文学气质 */
.snowball-header {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px) saturate(120%);
  -webkit-backdrop-filter: blur(12px) saturate(120%);
  border-bottom: 1px solid rgba(232, 240, 254, 0.6);
  box-shadow: var(--shadow-header);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.header-content {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: 0 24px;
  height: var(--header-height);
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
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 400;
  letter-spacing: 0.08em;
  color: var(--color-primary);
  text-decoration: none;
}

.brand-name:hover {
  color: var(--color-primary-hover);
}

.brand-slogan {
  font-family: var(--font-serif);
  font-size: 12px;
  font-weight: 200;
  color: var(--color-text-secondary);
  margin-left: 8px;
}

/* 导航链接 */
.main-nav {
  display: flex;
  gap: 24px;
}

.nav-link {
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 15px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-normal);
}

.nav-link:hover {
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.nav-link.router-link-active {
  color: var(--color-primary);
  background: var(--color-primary-light);
  font-weight: 500;
}

.nav-link-dropdown.is-active {
  color: var(--color-primary);
  background: var(--color-primary-light);
}

/* 用户操作按钮 */
.user-actions {
  display: flex;
  gap: 12px;
}

.btn-login {
  padding: 8px 20px;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  text-decoration: none;
  font-size: 14px;
  transition: all var(--transition-normal);
}

.btn-login:hover {
  background: var(--color-primary-light);
}

.btn-register {
  padding: 8px 20px;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-sm);
  text-decoration: none;
  font-size: 14px;
  transition: all var(--transition-normal);
}

.btn-register:hover {
  background: var(--color-primary-hover);
}

.btn-logout {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  transition: all var(--transition-normal);
}

.btn-logout:hover {
  background: var(--color-bg);
  border-color: var(--color-border);
}

/* 页面内容区 */
.page-content {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: 32px 24px;
  min-height: calc(100vh - var(--header-height));
  background: linear-gradient(180deg, #e8f0fe 0%, var(--color-bg) 12%);
}

/* 下拉菜单 */
.nav-dropdown {
  position: relative;
  cursor: default;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.arrow {
  display: inline-block;
  font-size: 11px;
  margin-left: 4px;
  transition: transform 0.25s ease;
  vertical-align: 1px;
}

.arrow-open {
  transform: rotate(180deg);
}

.dropdown-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 180px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(16px) saturate(120%);
  -webkit-backdrop-filter: blur(16px) saturate(120%);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card-elevated);
  border: 1px solid var(--color-primary-border);
  padding: 6px 0;
  z-index: 1001;
  transform-origin: top center;
}

.dropdown-item {
  display: flex;
  flex-direction: column;
  padding: 10px 18px;
  text-decoration: none;
  transition: background var(--transition-fast);
}

.dropdown-item:hover {
  background: var(--color-primary-light);
}

.item-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.item-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.dropdown-badge {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  background: var(--color-notification);
  color: #fff;
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 600;
}

.item-soon {
  opacity: 0.55;
  pointer-events: none;
  cursor: not-allowed;
}
.soon-tag {
  font-size: 10px;
  padding: 1px 6px;
  background: var(--color-warning-bg);
  color: var(--color-warning);
  border-radius: 4px;
  margin-left: 6px;
  vertical-align: 2px;
}

.nav-link-dropdown.is-active,
.nav-link-dropdown:has(.router-link-active) {
  color: var(--color-primary);
  background: var(--color-primary-light);
}

/* Vue transition: dropdown */
.dropdown-enter-active {
  transition: opacity 0.2s ease, transform 0.25s ease;
}
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.2s ease;
}
.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-8px) scaleY(0.96);
}
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scaleY(0.97);
}

/* 通知铃铛按钮 */
.btn-notify {
  position: relative;
  padding: 8px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 16px;
  text-decoration: none;
  display: flex;
  align-items: center;
  transition: background var(--transition-fast);
}
.btn-notify:hover { background: var(--color-bg); }
.badge {
  position: absolute;
  top: -4px;
  right: -6px;
  background: var(--color-notification);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  line-height: 1;
}
</style>
