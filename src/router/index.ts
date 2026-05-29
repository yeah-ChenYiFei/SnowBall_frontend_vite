// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ROLES } from '@/constants/role' // ✅ 引入常量

// 按需引入所有页面组件 (保持你原来的不变)
import Home from '@/views/Home.vue'
import Plaza from '@/views/Plaza.vue'
import Create from '@/views/Create.vue'
import SettingWriting from '@/views/create/SettingWriting.vue'
import InspirationNote from '@/views/create/InspirationNote.vue'
import PostWriting from '@/views/create/PostWriting.vue'
import WorldDetail from '@/views/create/WorldDetail.vue'
import EntryDetail from '@/views/create/EntryDetail.vue'
import Explore from '@/views/Explore.vue'
import About from '@/views/About.vue'
import PostDetail from '@/views/post/PostDetail.vue'
import PostEdit from '@/views/post/PostEdit.vue'
import VersionHistory from '@/views/post/VersionHistory.vue'
import ChainDetail from '@/views/post/ChainDetail.vue'
import Login from '@/views/user/Login.vue'
import Register from '@/views/user/Register.vue'
import VerifyEmail from '@/views/user/VerifyEmail.vue'
import ForgotPassword from '@/views/user/ForgotPassword.vue'
import Settings from '@/views/user/Settings.vue'
import Profile from '@/views/user/Profile.vue'
import Groups from '@/views/user/Groups.vue'
import GroupDetail from '@/views/group/GroupDetail.vue'
import BookManage from '@/views/user/BookManage.vue'
import Friends from '@/views/user/Friends.vue'
import Notifications from '@/views/user/Notifications.vue'
import WritingCenter from '@/views/writing/WritingCenter.vue'
import WritingEditor from '@/views/writing/WritingEditor.vue'
import WritingLibrary from '@/views/writing/WritingLibrary.vue'
import WritingDiary from '@/views/writing/WritingDiary.vue'
import ChatView from '@/views/chat/ChatView.vue'
import PublicChains from '@/views/wild/PublicChains.vue'
import PublicChainDetail from '@/views/wild/PublicChainDetail.vue'
import PublicWorlds from '@/views/wild/PublicWorlds.vue'
import PublicWorldDetail from '@/views/wild/PublicWorldDetail.vue'
import PublicLibrary from '@/views/wild/PublicLibrary.vue'
import ArticleDetail from '@/views/wild/ArticleDetail.vue'
import NovelReader from '@/views/wild/NovelReader.vue'
import AdminDashboard from '@/views/admin/Dashboard.vue'
import AdminUserList from '@/views/admin/UserList.vue'
import AdminArticleList from '@/views/admin/ArticleList.vue'
import AdminWorldList from '@/views/admin/WorldList.vue'
import Favorites from '@/views/user/Favorites.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Plaza },
    { path: '/create', component: Create, meta: { requiresAuth: true } },
    { path: '/create/setting', component: SettingWriting },
    { path: '/create/setting/:worldId', component: WorldDetail },
    { path: '/create/setting/:worldId/entry/:entryId', component: EntryDetail },
    { path: '/create/inspiration', component: InspirationNote },
    { path: '/create/article', component: PostWriting },
    { path: '/explore', component: Explore },
    { path: '/about', component: About },
    { path: '/post/:id', component: PostDetail },
    { path: '/post/:id/edit', component: PostEdit, meta: { requiresAuth: true } },
    { path: '/post/:id/versions', component: VersionHistory, meta: { requiresAuth: true } },
    { path: '/chain/:id', component: ChainDetail },
    { path: '/login', component: Login },
    { path: '/register', component: Register },
    { path: '/verify-email', component: VerifyEmail },
    { path: '/forgot-password', component: ForgotPassword },
    { path: '/settings', component: Settings, meta: { requiresAuth: true } },
    { path: '/profile/:userId', component: Profile },
    { path: '/mine', redirect: (to: any) => `/profile/${to.query.userId || 'self'}` },
    { path: '/books', component: BookManage, meta: { requiresAuth: true } },
    { path: '/friends', component: Friends, meta: { requiresAuth: true } },
    { path: '/favorites', component: Favorites, meta: { requiresAuth: true } },
    { path: '/groups', component: Groups, meta: { requiresAuth: true } },
    { path: '/groups/:groupId', component: GroupDetail, meta: { requiresAuth: true } },
    { path: '/notifications', component: Notifications, meta: { requiresAuth: true } },
    { path: '/writing', component: WritingCenter },
    { path: '/writing/new', component: WritingEditor },
    { path: '/writing/library', component: WritingLibrary },
    { path: '/writing/diary', component: WritingDiary },
    { path: '/writing/:id', component: WritingEditor },
    { path: '/chat', component: ChatView, meta: { requiresAuth: true } },
    { path: '/chat/:userId', component: ChatView, meta: { requiresAuth: true } },

    // 旷野板块
    { path: '/wild/chains', component: PublicChains },
    { path: '/wild/chains/:chainId', component: PublicChainDetail },
    { path: '/wild/worlds', component: PublicWorlds },
    { path: '/wild/worlds/:id', component: PublicWorldDetail },
    { path: '/wild/library', component: PublicLibrary },
    { path: '/wild/library/novel/:id', component: NovelReader },
    { path: '/wild/library/:id', component: ArticleDetail },

    // 管理后台
    { path: '/admin', component: AdminDashboard, meta: { requiresAuth: true, requiredRoles: [ROLES.SYS_ADMIN] } },
    { path: '/admin/users', component: AdminUserList, meta: { requiresAuth: true, requiredRoles: [ROLES.SYS_ADMIN] } },
    { path: '/admin/articles', component: AdminArticleList, meta: { requiresAuth: true, requiredRoles: [ROLES.SYS_ADMIN] } },
    { path: '/admin/worlds', component: AdminWorldList, meta: { requiresAuth: true, requiredRoles: [ROLES.SYS_ADMIN] } },
  ]
})

// 无需登录即可访问的公共页面
const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/explore',
  '/about',
])

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.has(path)) return true
  // /post/:id 和 /chain/:id 也允许未登录查看
  if (/^\/post\/\d+$/.test(path)) return true
  if (/^\/chain\/\d+$/.test(path)) return true
  // 旷野公共接龙
  if (/^\/wild\/chains\/\d+$/.test(path)) return true
  if (path === '/wild/chains') return true
  if (/^\/wild\/worlds\/\d+$/.test(path)) return true
  if (path === '/wild/worlds') return true
  if (/^\/wild\/library\/\d+$/.test(path)) return true
  if (path === '/wild/library') return true
  return false
}

// 全局前置守卫
router.beforeEach(async (to, from) => {
  const userStore = useUserStore()

  // ✅ 必须等待用户信息加载完，否则刷新页面时 userInfo 是空的
  await userStore.waitReady()

  const isLoggedIn = userStore.isLogin()

  // 0. 未登录用户访问根路径 → 宣传登录页
  if (!isLoggedIn && to.path === '/') {
    return '/login'
  }

  // 1. 未登录用户只能访问公共页面，避免进入需要 API 调用的页面后 401 闪退回登录
  if (!isLoggedIn && !isPublicPath(to.path)) {
    return '/login'
  }

  // 2. 基础登录拦截（显式声明 requiresAuth 的页面）
  if (to.meta.requiresAuth && !isLoggedIn) {
    return '/login'
  }

  // 3. ✅ 基于角色的路由拦截（读取 meta.requiredRoles）
  if (to.meta.requiredRoles) {
    const requiredRoles = to.meta.requiredRoles as string[]
    const currentRole = userStore.userInfo?.role

    if (!currentRole || !requiredRoles.includes(currentRole)) {
      alert('无权访问该页面')
      return '/' // 没权限踢回首页
    }
  }

  return true
})

export default router
