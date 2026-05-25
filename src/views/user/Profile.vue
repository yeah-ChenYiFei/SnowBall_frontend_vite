<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import { useFriendStore } from '@/stores/friend'
import UserAvatar from '@/components/UserAvatar.vue'
import ImageLightbox from '@/components/ImageLightbox.vue'
import type { UserProfileFull, ContributionDay, RecentProject, BrowsingHistory, Activity, PublicChain, FriendshipStatus } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const friendStore = useFriendStore()

const profile = ref<UserProfileFull | null>(null)
const isLoading = ref(true)
const showAllProjects = ref(false)
const hoveredDay = ref<ContributionDay | null>(null)
const hoverPos = ref({ x: 0, y: 0 })
const editingSignature = ref(false)
const signatureText = ref('')
const uploadingAvatar = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)
const lightboxUrl = ref('')
const showLightbox = ref(false)
const friendStatus = ref<FriendshipStatus>({ status: 'NONE' })

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
    // Only use the known-working /users/:id/profile endpoint.
    // Other endpoints may not exist yet and could 401 → auto-logout.
    const res = await http.get(`/users/${id}/profile`)
    const userData = res.data

    const posts: any[] = userData?.posts || []
    const books: any[] = userData?.books || []

    // Build recent projects from posts only (safe data source)
    const recentProjects: RecentProject[] = posts
      .map((p: any) => ({ id: p.id, type: p.type, title: p.title, content: p.body || '', createdAt: p.createdAt }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Build contribution data from posts
    const contribMap = new Map<string, ContributionDay>()
    const addContrib = (date: string, item: { id: number; type: string; title: string }) => {
      const d = date.slice(0, 10)
      if (!contribMap.has(d)) contribMap.set(d, { date: d, count: 0, items: [] })
      const entry = contribMap.get(d)!
      entry.count++
      if (entry.items.length < 5) entry.items.push(item)
    }
    posts.forEach((p: any) => addContrib(p.createdAt, { id: p.id, type: p.type, title: p.title }))

    // Load browsing history from localStorage
    let browsingHistory: BrowsingHistory[] = []
    try {
      const stored = localStorage.getItem(`browseHistory_${id}`)
      if (stored) browsingHistory = JSON.parse(stored) as BrowsingHistory[]
      browsingHistory.sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())
    } catch { /* */ }

    // Load public chain activities
    let chainActivities: Activity[] = []
    try {
      const chainRes = await http.get<PublicChain[]>(`/users/${id}/chain-activities`)
      chainActivities = (chainRes.data || []).map((c: PublicChain) => ({
        id: c.id,
        type: 'PUBLIC_CHAIN',
        title: c.title,
        description: c.description,
        deadline: c.deadline,
        createdAt: c.createdAt,
        groupId: undefined,
        groupName: undefined,
      }))
    } catch { /* ignore */ }

    profile.value = {
      user: { ...userData?.user, signature: userData?.user?.signature || '' },
      recentProjects,
      contributions: Array.from(contribMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      browsingHistory,
      activities: chainActivities,
      stats: userData?.stats || {
        posts: posts.length,
        worlds: 0,
        articles: 0,
        inspirations: 0,
      },
    }
    // Check friend status for this profile (not self)
    if (!isSelf.value && id) {
      friendStatus.value = await friendStore.checkStatus(Number(id))
    }
  } catch {
    profile.value = null
  } finally {
    isLoading.value = false
  }
}

function triggerAvatarUpload() {
  if (!isSelf.value) return
  avatarInput.value?.click()
}

async function onAvatarFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { alert('请选择图片文件'); return }
  if (file.size > 10 * 1024 * 1024) { alert('图片不能超过10MB'); return }
  uploadingAvatar.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await http.post('/users/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    const newUrl = res.data.avatarUrl
    if (profile.value) profile.value.user.avatarUrl = newUrl
    if (userStore.userInfo) userStore.userInfo.avatarUrl = newUrl
  } catch (e: any) { alert(e.message || '上传失败') }
  finally { uploadingAvatar.value = false; input.value = '' }
}

function startEditSignature() {
  signatureText.value = profile.value?.user.signature || ''
  editingSignature.value = true
}

async function saveSignature() {
  try {
    await http.put('/users/profile', { signature: signatureText.value })
    if (profile.value) profile.value.user.signature = signatureText.value
    editingSignature.value = false
  } catch (e: any) { alert(e.message || '保存失败') }
}

function cancelEditSignature() {
  editingSignature.value = false
}

async function handleAddFriend() {
  await friendStore.sendRequest(Number(userId.value), 'PROFILE')
  friendStatus.value = { status: 'PENDING_TO_THEM' }
}

async function handleAcceptFriend() {
  if (!friendStatus.value.friendshipId) return
  await friendStore.acceptRequest(friendStatus.value.friendshipId)
  friendStatus.value = { status: 'FRIEND' }
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
  if (a.type === 'PUBLIC_CHAIN') router.push(`/wild/chains/${a.id}`)
  else if (a.type === 'CHAIN') router.push(`/chain/${a.id}`)
  else router.push(`/groups/${a.groupId}`)
}

// Contribution graph
const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

const contributionWeeks = computed(() => {
  if (!profile.value) return []
  const days = profile.value.contributions
  // Build 52 weeks back from today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Find the most recent Sunday as end, go back ~52 weeks
  const endDate = new Date(today)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - 364) // 52*7 = 364
  // Align start to Monday
  const dayOfWeek = startDate.getDay()
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  startDate.setDate(startDate.getDate() + offset)

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

// Compute which weeks start a new month
const monthLabels = computed(() => {
  const weeks = contributionWeeks.value
  if (weeks.length === 0) return []
  const labels: { idx: number; label: string }[] = []
  // Walk through week 0, day 0 to find date
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 364)
  const dow = startDate.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  startDate.setDate(startDate.getDate() + offset)
  let d = new Date(startDate)
  let lastMonth = -1
  for (let wi = 0; wi < weeks.length; wi++) {
    const firstDayDate = new Date(d)
    const month = firstDayDate.getMonth()
    if (month !== lastMonth) {
      labels.push({ idx: wi, label: MONTH_LABELS[month] })
      lastMonth = month
    }
    d.setDate(d.getDate() + 7)
  }
  return labels
})

function dayColor(day: ContributionDay | null): string {
  if (!day || day.count === 0) return '#ffffff'
  if (day.count <= 2) return '#c6e0ff'
  if (day.count <= 4) return '#7ab8f5'
  if (day.count <= 7) return '#3b8de0'
  return '#1a5fb8'
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
          <div class="avatar-wrapper" :class="{ clickable: isSelf }" @click="triggerAvatarUpload" :title="isSelf ? '点击更换头像' : ''">
            <UserAvatar
              :username="profile.user.username"
              :avatar-url="profile.user.avatarUrl"
              :size="88"
              class="user-avatar-lg"
            />
            <div v-if="isSelf" class="avatar-overlay"><span class="upload-hint">📷</span></div>
          </div>
          <input ref="avatarInput" type="file" accept="image/*" style="display:none" @change="onAvatarFileChange" />
          <h2 class="user-name">{{ profile.user.username }}</h2>

          <div class="signature-area">
            <template v-if="!editingSignature">
              <p class="user-signature">{{ profile.user.signature || '这个人很懒，还没有写签名...' }}</p>
              <button v-if="isSelf" class="btn-edit-signature" @click="startEditSignature" title="编辑签名">✎</button>
            </template>
            <div v-else class="signature-edit">
              <input v-model="signatureText" class="signature-input" placeholder="写一句签名..." maxlength="10" @keyup.enter="saveSignature" />
              <button class="btn-save-sig" @click="saveSignature">保存</button>
              <button class="btn-cancel-sig" @click="cancelEditSignature">取消</button>
            </div>
          </div>

          <div class="user-stats">
            <div class="stat-item" @click="router.push('/')">
              <span class="stat-num">{{ profile.stats.posts }}</span>
              <span class="stat-label">帖子</span>
            </div>
            <div class="stat-item" @click="router.push('/create/setting')">
              <span class="stat-num">{{ profile.stats.worlds }}</span>
              <span class="stat-label">世界</span>
            </div>
            <div class="stat-item" @click="router.push('/writing')">
              <span class="stat-num">{{ profile.stats.articles }}</span>
              <span class="stat-label">文章</span>
            </div>
            <div class="stat-item" @click="router.push('/create/inspiration')">
              <span class="stat-num">{{ profile.stats.inspirations }}</span>
              <span class="stat-label">灵感</span>
            </div>
          </div>

          <!-- Friend action area -->
          <div v-if="!isSelf" class="friend-action-area">
            <button v-if="friendStatus.status === 'NONE'" class="btn-add-friend" @click="handleAddFriend">➕ 加好友</button>
            <span v-else-if="friendStatus.status === 'FRIEND'" class="friend-badge">✅ 已加好友</span>
            <span v-else-if="friendStatus.status === 'PENDING_TO_THEM'" class="friend-badge pending">⏳ 已申请</span>
            <button v-else-if="friendStatus.status === 'PENDING_FROM_THEM'" class="btn-accept-friend" @click="handleAcceptFriend">📩 接受好友请求</button>
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
          <div class="contrib-wrapper" v-if="contributionWeeks.length > 0">
            <!-- Month labels row -->
            <div class="contrib-month-row">
              <div class="contrib-day-label-spacer"></div>
              <div class="contrib-month-labels">
                <span
                  v-for="(ml, mli) in monthLabels"
                  :key="mli"
                  class="contrib-month-label"
                  :style="{ gridColumn: ml.idx + 1 }"
                >{{ ml.label }}</span>
              </div>
            </div>
            <!-- Graph body: day labels + grid -->
            <div class="contrib-body" @mouseleave="onDayLeave">
              <div class="contrib-day-labels">
                <span v-for="(dl, dli) in DAY_LABELS" :key="dli" class="contrib-day-label">{{ dl }}</span>
              </div>
              <div class="contrib-grid">
                <div v-for="(week, wi) in contributionWeeks" :key="wi" class="contrib-week">
                  <div
                    v-for="(day, di) in week"
                    :key="di"
                    class="contrib-day"
                    :class="{ 'day-null': day === null, 'day-empty': day && day.count === 0 }"
                    :style="{ backgroundColor: dayColor(day) }"
                    @mouseenter="onDayEnter($event, day)"
                    @mouseleave="onDayLeave"
                    @click="onDayClick(day)"
                  />
                </div>
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
          <div v-else class="empty-hint">暂无创作记录</div>
          <div class="contrib-legend">
            <span>少</span>
            <span class="legend-block" style="background:#ffffff;border:1px solid #d0d7de"></span>
            <span class="legend-block" style="background:#c6e0ff"></span>
            <span class="legend-block" style="background:#7ab8f5"></span>
            <span class="legend-block" style="background:#3b8de0"></span>
            <span class="legend-block" style="background:#1a5fb8"></span>
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
                <span class="activity-icon">{{ a.type === 'PUBLIC_CHAIN' ? '📖' : a.type === 'CHAIN' ? '🔗' : '⚔️' }}</span>
                <div class="activity-info">
                  <span class="activity-title">{{ a.title }}</span>
                  <span class="activity-group">{{ a.groupName }}</span>
                </div>
                <span class="activity-type-tag">{{ a.type === 'PUBLIC_CHAIN' ? '公共接龙' : a.type === 'CHAIN' ? '接龙' : '擂台' }}</span>
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
    <ImageLightbox :visible="showLightbox" :image-url="lightboxUrl" @close="showLightbox = false" />
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
  margin: 0 auto 16px;
}

.avatar-wrapper { position: relative; display: inline-block; margin: 0 auto 16px; width: 88px; height: 88px; }
.avatar-wrapper.clickable { cursor: pointer; }
.avatar-overlay {
  position: absolute; inset: 0; border-radius: 50%;
  background: rgba(0,0,0,0); display: flex; align-items: center; justify-content: center;
  transition: background 0.2s; width: 100%; height: 100%;
}
.avatar-wrapper.clickable:hover .avatar-overlay { background: rgba(0,0,0,0.4); }
.upload-hint { opacity: 0; font-size: 20px; transition: opacity 0.2s; }
.avatar-wrapper.clickable:hover .upload-hint { opacity: 1; }

.signature-area { position: relative; margin-bottom: 24px; }
.user-signature { font-size: 13px; color: #999; margin: 0; line-height: 1.5; display: inline; }
.btn-edit-signature {
  background: none; border: 1px solid #dadce0; border-radius: 4px;
  cursor: pointer; font-size: 13px; color: #5f6368; padding: 2px 6px;
  margin-left: 6px; vertical-align: middle; transition: all 0.15s;
}
.btn-edit-signature:hover { border-color: #1a73e8; color: #1a73e8; background: #e8f0fe; }
.signature-edit { display: flex; gap: 6px; align-items: center; }
.signature-input { flex: 1; padding: 6px 10px; border: 1px solid #dadce0; border-radius: 6px; font-size: 13px; outline: none; min-width: 0; }
.signature-input:focus { border-color: #1a73e8; }
.btn-save-sig { padding: 4px 12px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; }
.btn-cancel-sig { padding: 4px 12px; background: #fff; color: #5f6368; border: 1px solid #dadce0; border-radius: 6px; font-size: 12px; cursor: pointer; }

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
  cursor: pointer;
  border-radius: 8px;
  padding: 4px 0;
  transition: background 0.15s;
}
.stat-item:hover { background: #f1f3f4; }

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

.friend-action-area {
  padding-top: 16px;
  border-top: 1px solid #f1f3f4;
  margin-top: 16px;
}
.btn-add-friend {
  width: 100%;
  padding: 8px 0;
  background: #1a73e8;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-add-friend:hover { background: #1557b0; }
.btn-accept-friend {
  width: 100%;
  padding: 8px 0;
  background: #e8f0fe;
  color: #1a73e8;
  border: 1px solid #1a73e8;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-accept-friend:hover { background: #d2e3fc; }
.friend-badge {
  display: block;
  text-align: center;
  padding: 8px 0;
  font-size: 14px;
  border-radius: 8px;
  background: #e6f4ea;
  color: #137333;
}
.friend-badge.pending {
  background: #fef7e0;
  color: #e37400;
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
.contrib-wrapper {
  position: relative;
  overflow-x: auto;
}

.contrib-month-row {
  display: flex;
  margin-bottom: 4px;
}

.contrib-day-label-spacer {
  width: 28px;
  flex-shrink: 0;
}

.contrib-month-labels {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 15px;
  gap: 3px;
  position: relative;
}

.contrib-month-label {
  font-size: 10px;
  color: #999;
  white-space: nowrap;
}

.contrib-body {
  display: flex;
}

.contrib-day-labels {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-right: 6px;
  flex-shrink: 0;
}

.contrib-day-label {
  width: 28px;
  height: 15px;
  font-size: 10px;
  color: #999;
  line-height: 15px;
  text-align: right;
  padding-right: 4px;
}

.contrib-grid {
  display: flex;
  gap: 3px;
}

.contrib-week {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.contrib-day {
  width: 15px;
  height: 15px;
  border-radius: 2px;
  cursor: pointer;
  transition: outline 0.1s;
  border: 1px solid rgba(27,31,35,0.06);
  box-sizing: border-box;
}
.contrib-day:not(.day-null):hover {
  outline: 2px solid #1a73e8;
  outline-offset: -1px;
}
.contrib-day.day-null {
  visibility: hidden;
}
.contrib-day.day-empty {
  background: #ffffff !important;
  border: 1px solid #ebedf0;
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
