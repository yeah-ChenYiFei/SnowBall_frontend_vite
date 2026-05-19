<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useUserStore } from './stores/user'
import { useRouter } from 'vue-router'
import http from '@/api/http'

const userStore = useUserStore()
const router = useRouter()

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
            我的 ({{ userStore.userInfo.username }})
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

.nav-link-dropdown.is-active {
  color: #1a73e8;
  background: #e8f0fe;
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
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.10), 0 2px 6px rgba(0, 0, 0, 0.06);
  border: 1px solid #e8f0fe;
  padding: 6px 0;
  z-index: 1001;
  transform-origin: top center;
}

.dropdown-item {
  display: flex;
  flex-direction: column;
  padding: 10px 18px;
  text-decoration: none;
  transition: background 0.15s ease;
}

.dropdown-item:hover {
  background: #e8f0fe;
}

.item-label {
  font-size: 14px;
  font-weight: 500;
  color: #202124;
}

.item-desc {
  font-size: 12px;
  color: #5f6368;
  margin-top: 2px;
}

.dropdown-badge {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  background: #ea4335;
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
  background: #fef7e0;
  color: #e37400;
  border-radius: 4px;
  margin-left: 6px;
  vertical-align: 2px;
}

/* Active state for wild routes — highlight the 旷野 dropdown */
.nav-link-dropdown.is-active,
.nav-link-dropdown:has(.router-link-active) {
  color: #1a73e8;
  background: #e8f0fe;
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
  background: white;
  border: 1px solid #dadce0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  text-decoration: none;
  display: flex;
  align-items: center;
  transition: background 0.2s;
}
.btn-notify:hover { background: #f8f9fa; }
.badge {
  position: absolute;
  top: -4px;
  right: -6px;
  background: #ea4335;
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
