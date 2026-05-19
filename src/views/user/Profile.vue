<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import type { UserProfileFull, ContributionDay, RecentProject, BrowsingHistory, Activity } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const profile = ref<UserProfileFull | null>(null)
const isLoading = ref(true)
const showAllProjects = ref(false)
const hoveredDay = ref<ContributionDay | null>(null)
const hoverPos = ref({ x: 0, y: 0 })

const userId = computed(() => {
  const id = route.params.userId as string
  if (id === 'self') return userStore.userInfo?.id || 0
  return Number(id)
})

const isSelf = computed(() => {
  const id = route.params.userId as string
  return id === 'self' || Number(id) === userStore.userInfo?.id
})

const visibleProjects = computed(() => {
  if (!profile.value) return []
  const list = profile.value.recentProjects
  return showAllProjects.value ? list : list.slice(0, 4)
})

const typeLabel: Record<string, string> = {
  OC: '原创角色', SETTING: '世界观', FRAGMENT: '小说片段', BOOK_INFO: '书籍信息',
  ESSAY: '散文', DIARY: '日记', NOVEL: '小说', WORLD: '设定世界',
  INSPIRATION: '灵感', POST: '帖子',
}

async function loadProfile() {
  const id = userId.value
  if (!id || id === 0) {
    isLoading.value = false
    return
  }
  isLoading.value = true
  try {
    // Use existing endpoints — load in parallel
    const [profileRes, articlesRes, worldsRes, inspirationsRes] = await Promise.all([
      http.get(`/users/${id}/profile`).catch(() => ({ data: null })),
      http.get('/articles', { params: { userId: id } }).catch(() => ({ data: [] })),
      http.get('/worlds').catch(() => ({ data: [] })),
      http.get('/inspirations').catch(() => ({ data: [] })),
    ])

    const userData = profileRes.data
    const allArticles = (articlesRes.data || []) as any[]
    const allWorlds = (worldsRes.data || []) as any[]
    const allInspirations = (inspirationsRes.data || []) as any[]

    // Build recent projects from posts + articles
    const posts = (userData?.posts || []) as any[]
    const recentProjects: RecentProject[] = [
      ...posts.map((p: any) => ({ id: p.id, type: p.type, title: p.title, content: p.body || '', createdAt: p.createdAt })),
      ...allArticles.map((a: any) => ({ id: a.id, type: a.type, title: a.title, content: a.body || '', createdAt: a.createdAt })),
      ...allWorlds.filter((w: any) => w.userId === id).map((w: any) => ({ id: w.id, type: 'WORLD', title: w.name, content: w.description || '', createdAt: w.createdAt })),
      ...allInspirations.filter((i: any) => i.userId === id).map((i: any) => ({ id: i.id, type: 'INSPIRATION', title: '灵感记录', content: i.content || '', createdAt: i.createdAt })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Build contribution data from all items
    const contribMap = new Map<string, ContributionDay>()
    const addContrib = (date: string, item: { id: number; type: string; title: string }) => {
      const d = date.slice(0, 10)
      if (!contribMap.has(d)) contribMap.set(d, { date: d, count: 0, items: [] })
      const entry = contribMap.get(d)!
      entry.count++
      if (entry.items.length < 5) entry.items.push(item)
    }
    posts.forEach((p: any) => addContrib(p.createdAt, { id: p.id, type: p.type, title: p.title }))
    allArticles.forEach((a: any) => addContrib(a.createdAt, { id: a.id, type: a.type, title: a.title }))
    allWorlds.filter((w: any) => w.userId === id).forEach((w: any) => addContrib(w.createdAt, { id: w.id, type: 'WORLD', title: w.name }))
    allInspirations.forEach((i: any) => addContrib(i.createdAt, { id: i.id, type: 'INSPIRATION', title: i.content?.slice(0, 20) || '灵感' }))

    profile.value = {
      user: { ...userData?.user, signature: userData?.user?.signature || '' },
      recentProjects,
      contributions: Array.from(contribMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      browsingHistory: [],
      activities: [],
      stats: {
        posts: posts.length,
        worlds: allWorlds.filter((w: any) => w.userId === id).length,
        articles: allArticles.length,
        inspirations: allInspirations.length,
      },
    }
  } catch {
    profile.value = null
  } finally {
    isLoading.value = false
  }
}

function goToProject(p: RecentProject) {
  const routes: Record<string, string> = {
    WORLD: '/create/setting',
    FRAGMENT: '/post',
    OC: '/post',
    BOOK_INFO: '/post',
    SETTING: '/create/setting',
    ESSAY: '/writing',
    DIARY: '/writing',
    NOVEL: '/writing',
    INSPIRATION: '/create/inspiration',
    POST: '/post',
  }
  const base = routes[p.type] || '/post'
  if (base === '/post' || base === '/writing') {
    router.push(`${base}/${p.id}`)
  } else if (base === '/create/setting') {
    router.push(`${base}/${p.id}`)
  } else {
    router.push(base)
  }
}

function goToPost(postId: number) {
  router.push(`/post/${postId}`)
}

function goToActivity(a: Activity) {
  if (a.type === 'CHAIN') router.push(`/chain/${a.id}`)
  else router.push(`/groups/${a.groupId}`)
}

// Contribution graph
const contributionWeeks = computed(() => {
  if (!profile.value) return []
  const days = profile.value.contributions
  if (days.length === 0) return []
  // Build 52 weeks (plus current) from today back
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 365 + (7 - startDate.getDay()))
  startDate.setHours(0, 0, 0, 0)

  const dayMap = new Map<string, ContributionDay>()
  days.forEach(d => dayMap.set(d.date, d))

  const weeks: (ContributionDay | null)[][] = []
  let currentDate = new Date(startDate)
  while (currentDate <= today) {
    const week: (ContributionDay | null)[] = []
    for (let i = 0; i < 7; i++) {
      if (currentDate > today) {
        week.push(null)
      } else {
        const key = currentDate.toISOString().slice(0, 10)
        week.push(dayMap.get(key) || null)
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
})

function dayColor(day: ContributionDay | null): string {
  if (!day || day.count === 0) return '#ebedf0'
  if (day.count <= 2) return '#9be9a8'
  if (day.count <= 4) return '#40c463'
  if (day.count <= 7) return '#30a14e'
  return '#216e39'
}

function onDayEnter(e: MouseEvent, day: ContributionDay | null) {
  if (!day) { hoveredDay.value = null; return }
  hoveredDay.value = day
  hoverPos.value = { x: e.clientX, y: e.clientY - 80 }
}

function onDayLeave() {
  hoveredDay.value = null
}

function onDayClick(day: ContributionDay | null) {
  if (!day || day.items.length === 0) return
  const item = day.items[0]
  const routes: Record<string, string> = { ARTICLE: '/writing', POST: '/post', WORLD: '/create/setting' }
  router.push(`${routes[item.type] || '/post'}/${item.id}`)
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('zh-CN')

onMounted(loadProfile)
watch(() => route.params.userId, loadProfile)
</script>

<template>
  <div class="profile-page">
    <div v-if="isLoading" class="loading-state">加载中...</div>

    <template v-else-if="profile">
      <!-- Left Column: User Info -->
      <aside class="profile-left">
        <div class="user-card">
          <div class="user-avatar-lg">{{ profile.user.username?.charAt(0)?.toUpperCase() || 'U' }}</div>
          <h2 class="user-name">{{ profile.user.username }}</h2>
          <p class="user-signature">{{ profile.user.signature || '这个人很懒，还没有写签名...' }}</p>
          <div class="user-stats">
            <div class="stat-item">
              <span class="stat-num">{{ profile.stats.posts }}</span>
              <span class="stat-label">帖子</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">{{ profile.stats.worlds }}</span>
              <span class="stat-label">世界</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">{{ profile.stats.articles }}</span>
              <span class="stat-label">文章</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">{{ profile.stats.inspirations }}</span>
              <span class="stat-label">灵感</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- Right Column: Content -->
      <div class="profile-right">
        <!-- Recent Projects -->
        <section class="section-card">
          <div class="section-header">
            <h3>最近项目</h3>
            <button
              v-if="profile.recentProjects.length > 4"
              class="btn-expand"
              @click="showAllProjects = !showAllProjects"
            >
              {{ showAllProjects ? '收起' : '展开' }}
            </button>
          </div>
          <div v-if="profile.recentProjects.length === 0" class="empty-hint">暂无项目</div>
          <div v-else class="projects-grid">
            <div
              v-for="p in visibleProjects"
              :key="`${p.type}-${p.id}`"
              class="project-card"
              @click="goToProject(p)"
            >
              <div class="project-header">
                <span class="project-type">{{ typeLabel[p.type] || p.type }}</span>
                <span class="project-date">{{ formatDate(p.createdAt) }}</span>
              </div>
              <h4 class="project-title">{{ p.title }}</h4>
              <p class="project-content">{{ p.content?.substring(0, 80) }}{{ p.content?.length > 80 ? '...' : '' }}</p>
            </div>
          </div>
        </section>

        <!-- Contribution Graph -->
        <section class="section-card">
          <h3>创作热力图</h3>
          <div class="contrib-container">
            <div v-if="contributionWeeks.length === 0" class="empty-hint">暂无创作记录</div>
            <div v-else class="contrib-graph" @mouseleave="onDayLeave">
              <div v-for="(week, wi) in contributionWeeks" :key="wi" class="contrib-week">
                <div
                  v-for="(day, di) in week"
                  :key="di"
                  class="contrib-day"
                  :class="{ 'day-null': day === null }"
                  :style="{ backgroundColor: dayColor(day) }"
                  @mouseenter="onDayEnter($event, day)"
                  @mouseleave="onDayLeave"
                  @click="onDayClick(day)"
                />
              </div>
            </div>
            <!-- Tooltip -->
            <div
              v-if="hoveredDay"
              class="contrib-tooltip"
              :style="{ left: hoverPos.x + 'px', top: hoverPos.y + 'px' }"
            >
              <div class="tooltip-date">{{ hoveredDay.date }}</div>
              <div class="tooltip-count">{{ hoveredDay.count }} 次创作</div>
              <div v-if="hoveredDay.items.length > 0" class="tooltip-items">
                <div v-for="item in hoveredDay.items.slice(0, 3)" :key="item.id" class="tooltip-item">
                  {{ typeLabel[item.type] || item.type }}: {{ item.title }}
                </div>
              </div>
            </div>
          </div>
          <div class="contrib-legend">
            <span>少</span>
            <span class="legend-block" style="background:#ebedf0"></span>
            <span class="legend-block" style="background:#9be9a8"></span>
            <span class="legend-block" style="background:#40c463"></span>
            <span class="legend-block" style="background:#30a14e"></span>
            <span class="legend-block" style="background:#216e39"></span>
            <span>多</span>
          </div>
        </section>

        <!-- Bottom Two Cards -->
        <div class="bottom-row">
          <!-- Browsing History -->
          <section class="section-card bottom-card">
            <h3>浏览历史</h3>
            <div v-if="profile.browsingHistory.length === 0" class="empty-hint">暂无浏览记录</div>
            <ul v-else class="history-list">
              <li
                v-for="h in profile.browsingHistory.slice(0, 5)"
                :key="h.postId"
                class="history-item"
                @click="goToPost(h.postId)"
              >
                <span class="history-type-tag">{{ typeLabel[h.postType] || h.postType }}</span>
                <span class="history-title">{{ h.postTitle }}</span>
                <span class="history-time">{{ formatDate(h.viewedAt) }}</span>
              </li>
            </ul>
          </section>

          <!-- Activities -->
          <section class="section-card bottom-card">
            <h3>正在参加的活动</h3>
            <div v-if="profile.activities.length === 0" class="empty-hint">暂无进行中的活动</div>
            <ul v-else class="activity-list">
              <li
                v-for="a in profile.activities"
                :key="`${a.type}-${a.id}`"
                class="activity-item"
                @click="goToActivity(a)"
              >
                <span class="activity-icon">{{ a.type === 'CHAIN' ? '🔗' : '⚔️' }}</span>
                <div class="activity-info">
                  <span class="activity-title">{{ a.title }}</span>
                  <span class="activity-group">{{ a.groupName }}</span>
                </div>
                <span class="activity-type-tag">{{ a.type === 'CHAIN' ? '接龙' : '擂台' }}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>

    <div v-else class="error-state">
      <p>用户不存在或加载失败</p>
      <router-link to="/">返回广场</router-link>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 28px 20px;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 24px;
  align-items: start;
}

.loading-state, .error-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px;
  color: #999;
}
.error-state a { color: #1a73e8; }

/* ===== Left Column ===== */
.profile-left {
  position: sticky;
  top: 84px;
}

.user-card {
  background: #fff;
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  border: 1px solid #e8f0fe;
}

.user-avatar-lg {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1a73e8, #4285f4);
  color: #fff;
  font-size: 36px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.user-name {
  font-size: 20px;
  font-weight: 700;
  color: #202124;
  margin: 0 0 8px;
}

.user-signature {
  font-size: 13px;
  color: #999;
  margin: 0 0 24px;
  line-height: 1.5;
  min-height: 20px;
}

.user-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid #f1f3f4;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 22px;
  font-weight: 700;
  color: #1a73e8;
}

.stat-label {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

/* ===== Right Column ===== */
.profile-right {
  min-width: 0;
}

.section-card {
  background: #fff;
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  border: 1px solid #f1f3f4;
  margin-bottom: 20px;
}

.section-card h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #202124;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
}

.btn-expand {
  padding: 4px 14px;
  border: 1px solid #dadce0;
  background: #fff;
  color: #5f6368;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-expand:hover {
  color: #1a73e8;
  border-color: #1a73e8;
}

.empty-hint {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 20px 0;
}

/* Projects Grid */
.projects-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.project-card {
  padding: 16px;
  border: 1px solid #e8eaed;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.project-card:hover {
  border-color: #1a73e8;
  box-shadow: 0 2px 8px rgba(26,115,232,0.08);
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.project-type {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #e8f0fe;
  color: #1a73e8;
  font-weight: 500;
}

.project-date {
  font-size: 12px;
  color: #999;
}

.project-title {
  font-size: 15px;
  font-weight: 600;
  color: #202124;
  margin: 0 0 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-content {
  font-size: 13px;
  color: #5f6368;
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Contribution Graph */
.contrib-container {
  position: relative;
  overflow-x: auto;
  padding-bottom: 4px;
}

.contrib-graph {
  display: flex;
  gap: 3px;
  min-width: fit-content;
}

.contrib-week {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.contrib-day {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  cursor: pointer;
  transition: outline 0.1s;
}
.contrib-day:not(.day-null):hover {
  outline: 2px solid #1a73e8;
  outline-offset: 1px;
}
.contrib-day.day-null {
  visibility: hidden;
}

.contrib-tooltip {
  position: fixed;
  z-index: 3000;
  background: #24292e;
  color: #fff;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  pointer-events: none;
  transform: translate(-50%, -100%);
  white-space: nowrap;
}
.tooltip-date { font-weight: 600; margin-bottom: 4px; }
.tooltip-count { color: #8b949e; margin-bottom: 4px; }
.tooltip-items { font-size: 12px; color: #c9d1d9; }
.tooltip-item { overflow: hidden; text-overflow: ellipsis; max-width: 200px; }

.contrib-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 10px;
  font-size: 11px;
  color: #999;
}
.legend-block {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

/* Bottom Row */
.bottom-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.bottom-card {
  margin-bottom: 0;
}

/* History List */
.history-list, .activity-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #f8f9fa;
  cursor: pointer;
  transition: background 0.1s;
}
.history-item:hover { background: #f8f9fa; margin: 0 -12px; padding: 10px 12px; border-radius: 6px; }
.history-item:last-child { border-bottom: none; }

.history-type-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #e8f0fe;
  color: #1a73e8;
  flex-shrink: 0;
}

.history-title {
  flex: 1;
  font-size: 14px;
  color: #202124;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-time {
  font-size: 12px;
  color: #999;
  flex-shrink: 0;
}

/* Activity List */
.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f8f9fa;
  cursor: pointer;
  transition: background 0.1s;
}
.activity-item:hover { background: #f8f9fa; margin: 0 -12px; padding: 12px; border-radius: 6px; }
.activity-item:last-child { border-bottom: none; }

.activity-icon { font-size: 20px; flex-shrink: 0; }
.activity-info { flex: 1; min-width: 0; }
.activity-title { font-size: 14px; color: #202124; font-weight: 500; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.activity-group { font-size: 12px; color: #999; }
.activity-type-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #fef7e0;
  color: #e37400;
  flex-shrink: 0;
}

@media (max-width: 860px) {
  .profile-page {
    grid-template-columns: 1fr;
  }
  .profile-left {
    position: static;
  }
  .projects-grid {
    grid-template-columns: 1fr;
  }
  .bottom-row {
    grid-template-columns: 1fr;
  }
}
</style>
