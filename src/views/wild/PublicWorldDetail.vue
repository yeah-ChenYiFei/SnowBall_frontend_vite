<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import type { World as WorldVO, WorldEntry, ArticleFull, GenericComment } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const worldId = Number(route.params.id)

const world = ref<WorldVO | null>(null)
const entries = ref<WorldEntry[]>([])
const boundArticles = ref<ArticleFull[]>([])
const isLoading = ref(true)

// Join request
const showJoinModal = ref(false)
const joinReason = ref('')
const isSubmittingJoin = ref(false)
const joinRequests = ref<any[]>([])
const showRequestsPanel = ref(false)

// Comments
const comments = ref<GenericComment[]>([])
const newComment = ref('')
const isLoadingComments = ref(false)

const isOwner = computed(() => world.value?.userId === userStore.userInfo?.id)
const isCollab = computed(() => world.value?.isCollaborator === true)

const loadAll = async () => {
  isLoading.value = true
  try {
    const [wRes, eRes, aRes] = await Promise.all([
      http.get<WorldVO>(`/worlds/${worldId}`),
      http.get<WorldEntry[]>(`/worlds/${worldId}/entries`).then(r => r.data).catch(() => []),
      http.get<ArticleFull[]>(`/articles/by-world/${worldId}`).then(r => r.data || []).catch(() => []),
    ])
    world.value = wRes.data
    entries.value = eRes as WorldEntry[]
    boundArticles.value = aRes
  } catch { /* */ }
  finally { isLoading.value = false }
}

const loadComments = async () => {
  isLoadingComments.value = true
  try {
    const res = await http.get<GenericComment[]>('/comments', { params: { sourceType: 'WORLD', sourceId: worldId } })
    const list = res.data || []
    // Build tree
    const map: Record<number, any> = {}
    const roots: any[] = []
    list.forEach((c: any) => { map[c.id] = { ...c, children: [] } })
    list.forEach((c: any) => {
      if (c.parentId && map[c.parentId]) map[c.parentId].children.push(map[c.id])
      else roots.push(map[c.id])
    })
    comments.value = roots
  } catch { /* */ }
  finally { isLoadingComments.value = false }
}

const submitComment = async () => {
  if (!newComment.value.trim() || !userStore.isLogin()) return
  try {
    await http.post('/comments', { body: newComment.value.trim(), parentId: null }, {
      params: { sourceType: 'WORLD', sourceId: worldId },
    } as any)
    newComment.value = ''
    loadComments()
  } catch (e: any) { alert(e.message || '评论失败') }
}

const handleJoinRequest = async () => {
  if (!joinReason.value.trim()) return
  isSubmittingJoin.value = true
  try {
    await http.post(`/worlds/${worldId}/join-request`, { reason: joinReason.value.trim() })
    showJoinModal.value = false
    joinReason.value = ''
    alert('申请已发送，请等待世界主人审核')
  } catch (e: any) { alert(e.message || '申请失败') }
  finally { isSubmittingJoin.value = false }
}

const loadJoinRequests = async () => {
  try {
    const res = await http.get(`/worlds/${worldId}/join-requests`)
    joinRequests.value = res.data || []
    showRequestsPanel.value = true
  } catch { /* */ }
}

const handleReviewJoin = async (reqId: number, approved: boolean) => {
  try {
    await http.put(`/worlds/${worldId}/join-requests/${reqId}`, { approved })
    loadJoinRequests()
  } catch (e: any) { alert(e.message || '操作失败') }
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('zh-CN')

onMounted(() => { loadAll(); loadComments() })
</script>

<template>
  <div class="public-world-page">
    <div v-if="isLoading" class="loading-state">加载中...</div>

    <template v-else-if="world">
      <button class="btn-back" @click="router.push('/wild/worlds')">← 返回大世界</button>

      <div class="world-header">
        <div class="header-top">
          <div>
            <h1 class="world-name">{{ world.name }}</h1>
            <span class="world-type-badge">{{ world.type }}</span>
            <span class="world-entries-count">{{ entries.length }} 条目</span>
          </div>
          <div class="header-actions">
            <button
              v-if="userStore.isLogin() && !isOwner && !isCollab"
              class="btn-join"
              @click="showJoinModal = true"
            >
              申请加入共创
            </button>
            <button
              v-if="isOwner"
              class="btn-manage"
              @click="loadJoinRequests"
            >
              管理共创申请
            </button>
          </div>
        </div>
        <p v-if="world.description" class="world-desc">{{ world.description }}</p>
        <div class="world-meta">
          <span>创建于 {{ formatDate(world.createdAt) }}</span>
          <span v-if="isOwner" class="owner-tag">你拥有这个世界</span>
          <span v-if="isCollab" class="collab-tag">你是共创者</span>
        </div>
      </div>

      <!-- Join requests panel (owner only) -->
      <div v-if="showRequestsPanel" class="requests-panel">
        <h3>共创申请</h3>
        <div v-if="joinRequests.length === 0" class="empty-hint">暂无申请</div>
        <div v-for="req in joinRequests" :key="req.id" class="request-item">
          <div class="req-info">
            <span class="req-name">{{ req.applicantName }}</span>
            <span class="req-reason">{{ req.reason }}</span>
            <span class="req-time">{{ formatDate(req.createdAt) }}</span>
          </div>
          <div v-if="req.status === 'PENDING'" class="req-actions">
            <button class="btn-approve" @click="handleReviewJoin(req.id, true)">✓ 通过</button>
            <button class="btn-reject" @click="handleReviewJoin(req.id, false)">✕ 拒绝</button>
          </div>
          <span v-else class="req-status">{{ req.status === 'APPROVED' ? '已通过' : '已拒绝' }}</span>
        </div>
      </div>

      <!-- Entries -->
      <section class="entries-section">
        <h3>世界条目</h3>
        <div v-if="entries.length === 0" class="empty-hint">暂无条目</div>
        <div v-else class="entries-grid">
          <div v-for="e in entries" :key="e.id" class="entry-card">
            <div class="entry-top">
              <span class="entry-type">{{ e.type }}</span>
            </div>
            <h4 class="entry-name">{{ e.name }}</h4>
            <p class="entry-preview">{{ (e.contentPreview || e.content || '').substring(0, 100) }}</p>
          </div>
        </div>
      </section>

      <!-- Bound articles -->
      <section v-if="boundArticles.length > 0" class="bound-section">
        <h3>绑定文章</h3>
        <div class="bound-list">
          <div
            v-for="a in boundArticles"
            :key="a.id"
            class="bound-item"
            @click="router.push(`/wild/library/${a.id}`)"
          >
            <span class="bound-type">{{ a.type === 'NOVEL' ? '小说' : '散文' }}</span>
            <span class="bound-title">{{ a.title }}</span>
            <span class="bound-author">{{ a.authorName }}</span>
          </div>
        </div>
      </section>

      <!-- Comments -->
      <section class="comments-section">
        <h3>评论 ({{ comments.length }})</h3>
        <div v-if="userStore.isLogin()" class="comment-form">
          <textarea v-model="newComment" placeholder="发表评论..." rows="3" class="comment-textarea"></textarea>
          <button class="btn-comment" :disabled="!newComment.trim()" @click="submitComment">发表评论</button>
        </div>
        <div v-if="isLoadingComments" class="loading-hint">加载评论中...</div>
        <div v-else-if="comments.length === 0" class="empty-hint">暂无评论</div>
        <div v-else class="comment-list">
          <div v-for="c in comments" :key="c.id" class="comment-item">
            <div class="comment-header">
              <span class="comment-author" @click="router.push(`/profile/${c.userId}`)">{{ c.authorName }}</span>
              <span class="comment-time">{{ formatDate(c.createdAt) }}</span>
            </div>
            <p class="comment-body">{{ c.body }}</p>
          </div>
        </div>
      </section>

      <!-- Join modal -->
      <Teleport to="body">
        <div v-if="showJoinModal" class="modal-overlay" @click.self="showJoinModal = false">
          <div class="modal-card">
            <h3>申请加入共创</h3>
            <textarea v-model="joinReason" placeholder="写一段申请理由..." rows="4" class="modal-textarea"></textarea>
            <div class="modal-actions">
              <button class="btn-cancel" @click="showJoinModal = false">取消</button>
              <button class="btn-submit" :disabled="!joinReason.trim() || isSubmittingJoin" @click="handleJoinRequest">发送申请</button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>

    <div v-else class="error-state">世界不存在</div>
  </div>
</template>

<style scoped>
.public-world-page { max-width: 900px; margin: 0 auto; padding: 28px 20px; }
.loading-state, .error-state { text-align: center; padding: 60px; color: #999; }
.btn-back { background: none; border: none; color: #1a73e8; cursor: pointer; font-size: 14px; padding: 0; margin-bottom: 16px; }

.world-header { background: #fff; border-radius: 14px; padding: 28px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); border: 1px solid #f1f3f4; margin-bottom: 24px; }
.header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.world-name { font-size: 24px; font-weight: 700; color: #202124; margin: 0 0 8px 0; }
.world-type-badge { font-size: 12px; padding: 3px 10px; background: #e8f0fe; color: #1a73e8; border-radius: 4px; margin-right: 12px; }
.world-entries-count { font-size: 13px; color: #999; }
.world-desc { font-size: 14px; color: #5f6368; line-height: 1.6; margin: 16px 0; }
.world-meta { display: flex; gap: 16px; font-size: 13px; color: #999; }
.owner-tag { color: #1a73e8; font-weight: 500; }
.collab-tag { color: #137333; font-weight: 500; }

.btn-join { padding: 10px 22px; background: #1a73e8; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
.btn-join:hover { background: #1557b0; }
.btn-manage { padding: 10px 22px; background: #fff; color: #1a73e8; border: 1px solid #1a73e8; border-radius: 8px; cursor: pointer; font-size: 14px; }
.btn-manage:hover { background: #e8f0fe; }

/* Requests panel */
.requests-panel { background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); border: 1px solid #f1f3f4; margin-bottom: 24px; }
.requests-panel h3 { margin: 0 0 16px 0; font-size: 16px; }
.request-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1f3f4; gap: 12px; }
.req-info { flex: 1; min-width: 0; }
.req-name { font-weight: 600; color: #202124; display: block; }
.req-reason { font-size: 13px; color: #5f6368; display: block; margin-top: 2px; }
.req-time { font-size: 11px; color: #999; }
.req-actions { display: flex; gap: 8px; }
.btn-approve { padding: 4px 12px; border: 1px solid #ceead6; background: #e6f4ea; color: #137333; border-radius: 6px; cursor: pointer; }
.btn-reject { padding: 4px 12px; border: 1px solid #f28b82; background: #fce8e6; color: #c5221f; border-radius: 6px; cursor: pointer; }
.req-status { font-size: 12px; color: #999; }

/* Entries */
.entries-section { background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); border: 1px solid #f1f3f4; margin-bottom: 24px; }
.entries-section h3 { margin: 0 0 16px 0; font-size: 16px; }
.entries-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.entry-card { padding: 16px; border: 1px solid #e8eaed; border-radius: 10px; }
.entry-type { font-size: 11px; padding: 2px 8px; background: #f1f3f4; color: #5f6368; border-radius: 4px; }
.entry-name { font-size: 15px; font-weight: 600; color: #202124; margin: 8px 0 4px; }
.entry-preview { font-size: 12px; color: #999; margin: 0; }
.empty-hint { text-align: center; padding: 20px 0; color: #999; font-size: 14px; }

/* Bound articles */
.bound-section { background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); border: 1px solid #f1f3f4; margin-bottom: 24px; }
.bound-section h3 { margin: 0 0 16px 0; font-size: 16px; }
.bound-list { display: flex; flex-direction: column; gap: 8px; }
.bound-item { display: flex; gap: 12px; align-items: center; padding: 10px 12px; cursor: pointer; border-radius: 6px; transition: background 0.15s; }
.bound-item:hover { background: #f8f9fa; }
.bound-type { font-size: 12px; padding: 2px 8px; background: #e8f0fe; color: #1a73e8; border-radius: 4px; }
.bound-title { font-weight: 500; color: #202124; flex: 1; }
.bound-author { font-size: 13px; color: #999; }

/* Comments */
.comments-section { background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); border: 1px solid #f1f3f4; }
.comments-section h3 { margin: 0 0 16px 0; font-size: 16px; }
.comment-form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
.comment-textarea { width: 100%; border: 1px solid #dadce0; border-radius: 8px; padding: 12px; font-size: 14px; resize: vertical; box-sizing: border-box; }
.btn-comment { align-self: flex-end; padding: 8px 20px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
.btn-comment:disabled { opacity: 0.5; cursor: not-allowed; }
.comment-item { padding: 12px 0; border-bottom: 1px solid #f8f9fa; }
.comment-header { display: flex; gap: 12px; margin-bottom: 6px; }
.comment-author { font-weight: 600; color: #1a73e8; cursor: pointer; font-size: 13px; }
.comment-author:hover { text-decoration: underline; }
.comment-time { font-size: 12px; color: #999; }
.comment-body { font-size: 14px; color: #333; line-height: 1.5; margin: 0; }
.loading-hint { text-align: center; color: #999; padding: 20px 0; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; }
.modal-card { background: #fff; border-radius: 14px; padding: 28px; width: 100%; max-width: 480px; }
.modal-card h3 { margin: 0 0 16px 0; }
.modal-textarea { width: 100%; border: 1px solid #dadce0; border-radius: 8px; padding: 12px; font-size: 14px; resize: vertical; box-sizing: border-box; }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; }
.btn-cancel { padding: 8px 20px; background: #fff; border: 1px solid #dadce0; border-radius: 6px; cursor: pointer; }
.btn-submit { padding: 8px 20px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
