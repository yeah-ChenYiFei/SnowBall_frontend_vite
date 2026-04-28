// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

// 按需引入所有页面组件
import Home from '@/views/Home.vue'
import Create from '@/views/Create.vue'
import Explore from '@/views/Explore.vue'
import About from '@/views/About.vue'
import PostDetail from '@/views/post/PostDetail.vue'
import PostEdit from '@/views/post/PostEdit.vue'
import VersionHistory from '@/views/post/VersionHistory.vue'
import ChainDetail from '@/views/post/ChainDetail.vue'
import Login from '@/views/user/Login.vue'
import Register from '@/views/user/Register.vue'
import Mine from '@/views/user/Mine.vue'
import Groups from '@/views/user/Groups.vue'
import BookManage from '@/views/user/BookManage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/create', component: Create },
    { path: '/explore', component: Explore },
    { path: '/about', component: About },

    // ✅ 核心：将编辑和历史改为平级路由，不再作为 children
    { path: '/post/:id', component: PostDetail },
    { path: '/post/:id/edit', component: PostEdit },
    { path: '/post/:id/versions', component: VersionHistory },

    { path: '/chain/:id', component: ChainDetail },

    { path: '/login', component: Login },
    { path: '/register', component: Register },

    { path: '/mine', component: Mine },
    { path: '/groups', component: Groups },
    { path: '/books', component: BookManage },
  ]
})

// 全局前置守卫
router.beforeEach((to, from) => {
  const userStore = useUserStore()

  // 需要登录才能访问的路径白名单
  const needLogin = ['/create', '/mine', '/books', '/groups']

  if (needLogin.includes(to.path) && !userStore.isLogin()) {
    return '/login' // 重定向到登录
  }

  return true // 放行
})

export default router
