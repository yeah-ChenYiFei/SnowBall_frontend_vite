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
import ArticleWriting from '@/views/create/ArticleWriting.vue'
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

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Plaza },
    { path: '/create', component: Create, meta: { requiresAuth: true } },
    { path: '/create/setting', component: SettingWriting },
    { path: '/create/setting/:worldId', component: WorldDetail },
    { path: '/create/setting/:worldId/entry/:entryId', component: EntryDetail },
    { path: '/create/inspiration', component: InspirationNote },
    { path: '/create/article', component: ArticleWriting },
    { path: '/explore', component: Explore },
    { path: '/about', component: About },
    { path: '/post/:id', component: PostDetail },
    { path: '/post/:id/edit', component: PostEdit, meta: { requiresAuth: true } },
    { path: '/post/:id/versions', component: VersionHistory, meta: { requiresAuth: true } },
    { path: '/chain/:id', component: ChainDetail },
    { path: '/login', component: Login },
    { path: '/register', component: Register },
    { path: '/profile/:userId', component: Profile, meta: { requiresAuth: true } },
    { path: '/mine', redirect: (to: any) => `/profile/${to.query.userId || 'self'}` },
    { path: '/books', component: BookManage, meta: { requiresAuth: true } },
    { path: '/friends', component: Friends, meta: { requiresAuth: true } },
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

    // ✅ 示例：未来如果你加了后台管理页面，就这样配
    // { path: '/admin', component: () => import('@/views/admin/Dashboard.vue'), meta: { requiresAuth: true, requiredRoles: [ROLES.SYS_ADMIN] } }
  ]
})

// 全局前置守卫
router.beforeEach(async (to, from) => {
  const userStore = useUserStore()

  // ✅ 必须等待用户信息加载完，否则刷新页面时 userInfo 是空的
  await userStore.waitReady()

  // 1. 基础登录拦截
  if (to.meta.requiresAuth && !userStore.isLogin()) {
    return '/login'
  }

  // 2. ✅ 基于角色的路由拦截（读取 meta.requiredRoles）
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
