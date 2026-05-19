<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import { useFriendStore } from '@/stores/friend'
import type { GroupDetail, GroupMemberInfo, GroupMessage, UserProfileVO, ChainDetailVO, WritingBattle, BattleEntry } from '@/types'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const friendStore = useFriendStore()

const groupId = computed(() => Number(route.params.groupId))

// ---- Core state ----
const group = ref<GroupDetail | null>(null)
const messages = ref<GroupMessage[]>([])
const inputText = ref('')
const isLoading = ref(false)
const isSending = ref(false)
const messageArea = ref<HTMLElement | null>(null)

// Deduplicate activity cards: only show latest CHAIN/BATTLE message per refId
const displayMessages = computed(() => {
  const latest: Record<string, number> = {} // key="CHAIN:123" → messageId
  // Find latest message id per activity
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const m = messages.value[i]
    if ((m.type === 'CHAIN_START' || m.type === 'CHAIN_SEGMENT') && m.refId) {
      const key = `CHAIN:${m.refId}`
      if (!latest[key]) latest[key] = m.id
    } else if ((m.type === 'BATTLE_START' || m.type === 'BATTLE_ENTRY') && m.refId) {
      const key = `BATTLE:${m.refId}`
      if (!latest[key]) latest[key] = m.id
    }
  }
  const keepIds = new Set(Object.values(latest))
  return messages.value.filter(m => {
    if (m.type === 'CHAIN_START' || m.type === 'CHAIN_SEGMENT' || m.type === 'BATTLE_START' || m.type === 'BATTLE_ENTRY') {
      return keepIds.has(m.id)
    }
    return true
  })
})

// Context menu
const contextMenu = ref({ show: false, x: 0, y: 0, message: null as GroupMessage | null })
const quoteTarget = ref<GroupMessage | null>(null)

// User profile popup
const profilePopup = ref({ show: false, x: 0, y: 0, user: null as UserProfileVO | null, loading: false })

// ---- Activity expand state ----
const expandedChainId = ref<number | null>(null)
const expandedBattleId = ref<number | null>(null)
const chainDetail = ref<ChainDetailVO | null>(null)
const battleDetail = ref<WritingBattle | null>(null)
const chainSegmentText = ref('')
const chainSubmitting = ref(false)

// Battle modals
const showBattleEntryModal = ref(false)
const battleEntryTitle = ref('')
const battleEntryBody = ref('')
const battleEntrySubmitting = ref(false)

const showReviewModal = ref(false)
const reviewTargetEntryId = ref<number | null>(null)
const reviewScore = ref(8)
const reviewComment = ref('')
const reviewSubmitting = ref(false)

// Create modals
const showChainModal = ref(false)
const showBattleModal = ref(false)
const chainTitle = ref('')
const chainFirstBody = ref('')
const chainDeadline = ref('')
const battleTopic = ref('')
const battleDesc = ref('')
const battleDeadline = ref('')
const battleParticipants = ref<number[]>([])
const battleSubmitting = ref(false)

// Polling
let pollTimer: ReturnType<typeof setInterval> | null = null
const sinceId = ref<number>(0)

function isExpired(deadline: string | null | undefined): boolean {
  if (!deadline) return false
  const d = new Date(deadline)
  d.setHours(23, 59, 59, 999)
  return Date.now() > d.getTime()
}

// ---- Computed ----
const currentUserId = computed(() => userStore.userInfo?.id ?? 0)
const isGroupAdmin = computed(() => group.value?.creatorId === currentUserId.value)

function isBattleParticipant(battle: WritingBattle | null): boolean {
  if (!battle) return false
  // Check if current user is in participant list or is the creator
  const pids = (battle as any).participantIds as string
  if (!pids) return true // no restriction = everyone can participate
  return pids.split(',').map((s: string) => s.trim()).includes(String(currentUserId.value))
}

// ---- Init ----
onMounted(async () => {
  if (!groupId.value || isNaN(groupId.value)) return
  await loadGroup()
  await loadMessages()
  startPolling()
})

onUnmounted(() => { stopPolling() })

async function loadGroup() {
  if (!groupId.value || isNaN(groupId.value)) return
  try {
    const res = await http.get(`/groups/${groupId.value}`)
    group.value = res.data as GroupDetail
  } catch { /* silent */ }
}

async function loadMessages(since?: number) {
  if (isLoading.value) return
  if (!groupId.value || isNaN(groupId.value)) return
  if (!userStore.isLogin()) return
  isLoading.value = true
  try {
    const params: any = {}
    if (since) params.since = since
    const res = await http.get(`/groups/${groupId.value}/messages`, { params })
    const newMsgs = res.data as GroupMessage[]
    if (since && newMsgs.length > 0) {
      messages.value.push(...newMsgs)
    } else if (!since) {
      messages.value = newMsgs
    }
    if (messages.value.length > 0) {
      sinceId.value = messages.value[messages.value.length - 1].id
    }
  } catch { /* silent */ }
  finally { isLoading.value = false }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    if (!userStore.isLogin()) { stopPolling(); return }
    if (!groupId.value || isNaN(groupId.value)) return
    if (sinceId.value > 0) loadMessages(sinceId.value)
  }, 3000)
}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null } }

async function scrollToBottom() {
  await nextTick()
  if (messageArea.value) messageArea.value.scrollTop = messageArea.value.scrollHeight
}
watch(messages, () => scrollToBottom(), { deep: false })

// ---- Send message ----
async function sendMessage() {
  const text = inputText.value.trim()
  if (!text) return
  isSending.value = true
  try {
    const body: any = { body: text, type: 'CHAT' }
    if (quoteTarget.value) {
      body.body = `> ${quoteTarget.value.senderName}: ${quoteTarget.value.body}\n\n${text}`
      quoteTarget.value = null
    }
    await http.post(`/groups/${groupId.value}/messages`, body)
    inputText.value = ''
  } catch (e: any) { alert(e.message || '发送失败') }
  finally { isSending.value = false }
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
}

// ---- Right-click menu ----
function onMessageContextMenu(e: MouseEvent, msg: GroupMessage) {
  e.preventDefault()
  contextMenu.value = { show: true, x: e.clientX, y: e.clientY, message: msg }
}
function closeContextMenu() { contextMenu.value.show = false }
function copyMessageText() {
  if (contextMenu.value.message) navigator.clipboard.writeText(contextMenu.value.message.body)
  closeContextMenu()
}
function quoteMessage() {
  if (contextMenu.value.message) quoteTarget.value = contextMenu.value.message
  closeContextMenu()
}
async function deleteMessage() {
  const msg = contextMenu.value.message
  if (!msg) return
  try {
    await http.delete(`/groups/${groupId.value}/messages/${msg.id}`)
    messages.value = messages.value.filter(m => m.id !== msg.id)
  } catch (e: any) { alert(e.message || '删除失败') }
  closeContextMenu()
}
function canDeleteMessage(msg: GroupMessage): boolean {
  return isGroupAdmin.value || msg.senderId === currentUserId.value
}

// ---- User profile popup ----
async function showUserProfile(e: MouseEvent, userId: number) {
  const rect = (e.target as HTMLElement).getBoundingClientRect()
  profilePopup.value = { show: true, x: rect.left, y: rect.bottom + 4, user: null, loading: true }
  try {
    const res = await http.get(`/users/${userId}/profile`)
    profilePopup.value.user = res.data as UserProfileVO
  } catch { profilePopup.value.show = false }
  finally { profilePopup.value.loading = false }
}
function closeProfilePopup() { profilePopup.value.show = false }

// ---- Member actions ----
async function kickMember(userId: number) {
  if (!confirm('确定要踢出该成员吗？')) return
  try { await http.delete(`/groups/${groupId.value}/members/${userId}`); await loadGroup() }
  catch (e: any) { alert(e.message || '踢出失败') }
}
function onMemberContextMenu(e: MouseEvent, member: GroupMemberInfo) {
  e.preventDefault()
  if (!isGroupAdmin.value || member.userId === currentUserId.value) return
  if (confirm(`确定要踢出 ${member.username} 吗？`)) kickMember(member.userId)
}

// ---- Expand Chain ----
async function toggleChain(refId: number) {
  if (expandedChainId.value === refId) { expandedChainId.value = null; chainDetail.value = null; return }
  expandedBattleId.value = null; battleDetail.value = null
  expandedChainId.value = refId
  try {
    const res = await http.get(`/chains/${refId}`)
    chainDetail.value = res.data as ChainDetailVO
  } catch { expandedChainId.value = null }
}

async function submitChainSegment() {
  if (!chainSegmentText.value.trim() || !expandedChainId.value) return
  chainSubmitting.value = true
  try {
    await http.post(`/groups/${groupId.value}/chains/${expandedChainId.value}/segments`, {
      body: chainSegmentText.value,
    })
    chainSegmentText.value = ''
    const res = await http.get(`/chains/${expandedChainId.value}`)
    chainDetail.value = res.data as ChainDetailVO
  } catch (e: any) { alert(e.message || '提交失败') }
  finally { chainSubmitting.value = false }
}

// ---- Expand Battle ----
async function toggleBattle(refId: number) {
  if (expandedBattleId.value === refId) { expandedBattleId.value = null; battleDetail.value = null; return }
  expandedChainId.value = null; chainDetail.value = null
  expandedBattleId.value = refId
  try {
    const res = await http.get(`/groups/${groupId.value}/battles/${refId}`)
    battleDetail.value = res.data as WritingBattle
  } catch { expandedBattleId.value = null }
}

function openBattleEntryModal() {
  battleEntryTitle.value = ''
  battleEntryBody.value = ''
  showBattleEntryModal.value = true
}

async function submitBattleEntry() {
  if (!battleEntryTitle.value.trim() || !battleEntryBody.value.trim() || !expandedBattleId.value) return
  battleEntrySubmitting.value = true
  try {
    await http.post(`/groups/${groupId.value}/battles/${expandedBattleId.value}/entries`, {
      title: battleEntryTitle.value,
      body: battleEntryBody.value,
    })
    showBattleEntryModal.value = false
    const res = await http.get(`/groups/${groupId.value}/battles/${expandedBattleId.value}`)
    battleDetail.value = res.data as WritingBattle
  } catch (e: any) { alert(e.message || '提交失败') }
  finally { battleEntrySubmitting.value = false }
}

function openReviewModal(entryId: number) {
  reviewTargetEntryId.value = entryId
  reviewScore.value = 8
  reviewComment.value = ''
  showReviewModal.value = true
}

async function submitReview() {
  if (!reviewTargetEntryId.value) return
  reviewSubmitting.value = true
  try {
    await http.post(`/groups/battles/entries/${reviewTargetEntryId.value}/reviews`, {
      score: reviewScore.value,
      comment: reviewComment.value,
    })
    showReviewModal.value = false
    if (expandedBattleId.value) {
      const res = await http.get(`/groups/${groupId.value}/battles/${expandedBattleId.value}`)
      battleDetail.value = res.data as WritingBattle
    }
  } catch (e: any) { alert(e.message || '评审失败') }
  finally { reviewSubmitting.value = false }
}

// ---- Create Chain ----
async function createChain() {
  if (!chainTitle.value.trim() || !chainFirstBody.value.trim()) return
  chainSubmitting.value = true
  try {
    await http.post(`/groups/${groupId.value}/chains`, {
      title: chainTitle.value,
      first_segment_body: chainFirstBody.value,
      deadline: chainDeadline.value || null,
    })
    showChainModal.value = false
    chainTitle.value = ''
    chainFirstBody.value = ''
    chainDeadline.value = ''
    await loadMessages()
  } catch (e: any) { alert(e.message || '发起失败') }
  finally { chainSubmitting.value = false }
}

// ---- Create Battle ----
async function createBattle() {
  if (!battleTopic.value.trim()) return
  battleSubmitting.value = true
  try {
    await http.post(`/groups/${groupId.value}/battles`, {
      topic: battleTopic.value,
      description: battleDesc.value,
      deadline: battleDeadline.value || null,
      participantIds: battleParticipants.value,
    })
    showBattleModal.value = false
    battleTopic.value = ''
    battleDesc.value = ''
    battleDeadline.value = ''
    battleParticipants.value = []
    await loadMessages()
  } catch (e: any) { alert(e.message || '发起失败') }
  finally { battleSubmitting.value = false }
}

function toggleBattleParticipant(userId: number) {
  const idx = battleParticipants.value.indexOf(userId)
  if (idx >= 0) battleParticipants.value.splice(idx, 1)
  else battleParticipants.value.push(userId)
}

// ---- Helpers ----
function goBack() { router.push('/groups') }

const avatarColors = ['#1a73e8','#d93025','#1e8e3e','#f9ab00','#9334e6','#185abc','#c5221f','#137333']
function avatarColor(id: number): string { return avatarColors[id % avatarColors.length] }

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="group-detail">
    <!-- Header -->
    <div class="group-header">
      <button class="btn-back" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      <div class="group-header-info">
        <h2 class="group-name">{{ group?.name || '加载中...' }}</h2>
        <span class="group-meta">{{ group?.memberCount || 0 }} 位成员</span>
      </div>
      <div class="header-spacer"></div>
    </div>

    <!-- Body -->
    <div class="group-body">
      <!-- Message Area -->
      <div class="message-area" ref="messageArea">
        <div v-if="displayMessages.length === 0 && !isLoading" class="empty-chat">
          <div class="empty-icon">💬</div>
          <p>暂无消息，发送第一条消息吧</p>
        </div>

        <template v-for="msg in displayMessages" :key="msg.id">
          <!-- ========== CHAIN CARD ========== -->
          <div v-if="msg.type === 'CHAIN_START' || msg.type === 'CHAIN_SEGMENT'" class="activity-card chain-card" @click="toggleChain(msg.refId!)">
            <div class="ac-header">
              <span class="ac-badge chain-badge">&#x1F3D4; 滚雪球</span>
              <span class="ac-sender">{{ msg.senderName }} {{ msg.type === 'CHAIN_START' ? '发起了接龙' : '续写了接龙' }}</span>
              <span class="ac-time">{{ formatTime(msg.createdAt) }}</span>
            </div>
            <div class="ac-body">
              <div class="ac-title">{{ msg.body }}</div>
              <div class="ac-hint">点击参与故事接龙 →</div>
            </div>
            <!-- Expanded Chain View -->
            <div v-if="expandedChainId === msg.refId" class="expand-panel" @click.stop>
              <div v-if="!chainDetail" class="expand-loading">加载中...</div>
              <template v-else>
                <div v-if="chainDetail.deadline" class="battle-meta">
                  <span>截止: {{ formatDate(chainDetail.deadline) }}</span>
                  <span v-if="isExpired(chainDetail.deadline)" class="expired-tag">活动已截止</span>
                </div>
                <h4 class="expand-title">{{ chainDetail.title }}</h4>
                <div class="chain-timeline">
                  <div v-for="(seg, si) in chainDetail.segments || []" :key="seg.id" class="chain-segment">
                    <div class="seg-dot"></div>
                    <div class="seg-content">
                      <div class="seg-header">
                        <span class="seg-author" @click="showUserProfile($event, seg.userId)">{{ seg.username }}</span>
                        <span class="seg-time">{{ formatTime(seg.createdAt) }}</span>
                      </div>
                      <div class="seg-body">{{ seg.body }}</div>
                    </div>
                  </div>
                </div>
                <div v-if="!isExpired(chainDetail.deadline)" class="chain-input-row">
                  <textarea v-model="chainSegmentText" class="chain-textarea" rows="3" placeholder="接着写下去..."></textarea>
                  <button class="btn-submit-sm" @click="submitChainSegment" :disabled="chainSubmitting || !chainSegmentText.trim()">
                    {{ chainSubmitting ? '提交中...' : '续写' }}
                  </button>
                </div>
                <div v-else class="expired-notice">活动日期已截止，无法再续写</div>
              </template>
            </div>
          </div>

          <!-- ========== BATTLE CARD ========== -->
          <div v-else-if="msg.type === 'BATTLE_START' || msg.type === 'BATTLE_ENTRY'" class="activity-card battle-card" @click="toggleBattle(msg.refId!)">
            <div class="ac-header">
              <span class="ac-badge battle-badge">&#x2744; 打雪仗</span>
              <span class="ac-sender">{{ msg.senderName }} {{ msg.type === 'BATTLE_START' ? '发起了擂台' : '提交了作品' }}</span>
              <span class="ac-time">{{ formatTime(msg.createdAt) }}</span>
            </div>
            <div class="ac-body">
              <div class="ac-title">{{ msg.body }}</div>
              <div class="ac-hint">点击查看擂台详情 →</div>
            </div>
            <!-- Expanded Battle View -->
            <div v-if="expandedBattleId === msg.refId" class="expand-panel" @click.stop>
              <div v-if="!battleDetail" class="expand-loading">加载中...</div>
              <template v-else>
                <h4 class="expand-title">{{ battleDetail.topic }}</h4>
                <div v-if="battleDetail.description" class="battle-desc">{{ battleDetail.description }}</div>
                <div class="battle-meta">
                  <span>状态: <b>{{ battleDetail.status === 'OPEN' ? '开放中' : battleDetail.status === 'VOTING' ? '评审中' : '已关闭' }}</b></span>
                  <span v-if="battleDetail.deadline">截止: {{ formatDate(battleDetail.deadline) }}</span>
                  <span v-if="isExpired(battleDetail.deadline)" class="expired-tag">活动已截止</span>
                </div>

                <!-- Participant: can submit only if not expired -->
                <div v-if="isBattleParticipant(battleDetail) && battleDetail.status === 'OPEN' && !isExpired(battleDetail.deadline)" class="battle-actions">
                  <button class="btn-submit-sm" @click="openBattleEntryModal()">提交作品</button>
                </div>
                <div v-else-if="isBattleParticipant(battleDetail) && isExpired(battleDetail.deadline)" class="expired-notice">活动日期已截止，无法再提交</div>

                <!-- Entries -->
                <div v-if="battleDetail.entries && battleDetail.entries.length > 0" class="battle-entries">
                  <div v-for="entry in battleDetail.entries" :key="entry.id" class="battle-entry">
                    <div class="entry-header">
                      <span class="entry-author" @click="showUserProfile($event, entry.userId)">{{ entry.username }}</span>
                      <span class="entry-title">{{ entry.title }}</span>
                      <span v-if="entry.avgScore > 0" class="entry-score">⭐ {{ entry.avgScore }} ({{ entry.voteCount }}评)</span>
                    </div>
                    <div class="entry-body">{{ entry.body }}</div>
                    <div class="entry-reviews" v-if="entry.reviews && entry.reviews.length > 0">
                      <div v-for="r in entry.reviews" :key="r.id" class="review-item">
                        <span class="review-author">{{ r.reviewerName }}</span>
                        <span class="review-score">{{ '⭐'.repeat(Math.round(r.score / 2)) }} {{ r.score }}/10</span>
                        <span v-if="r.comment" class="review-comment">{{ r.comment }}</span>
                      </div>
                    </div>
                    <button class="btn-review-sm" @click="openReviewModal(entry.id)">评分/评论</button>
                  </div>
                </div>
                <div v-else class="expand-empty">暂无参赛作品</div>
              </template>
            </div>
          </div>

          <!-- ========== SYSTEM message ========== -->
          <div v-else-if="msg.type === 'SYSTEM'" class="message-row is-system">
            <div class="system-msg">
              <span class="system-sender">{{ msg.senderName }}</span>
              {{ msg.body }}
              <span class="system-time">{{ formatTime(msg.createdAt) }}</span>
            </div>
          </div>

          <!-- ========== Normal CHAT message ========== -->
          <div v-else :class="['message-row', { 'is-mine': msg.senderId === currentUserId }]" @contextmenu="onMessageContextMenu($event, msg)">
            <div class="msg-avatar" :style="{ background: avatarColor(msg.senderId) }" @click="showUserProfile($event, msg.senderId)">{{ msg.senderName?.charAt(0) || '?' }}</div>
            <div class="msg-content">
              <div class="msg-header">
                <span class="msg-sender" @click="showUserProfile($event, msg.senderId)">{{ msg.senderName }}</span>
                <span class="msg-time">{{ formatTime(msg.createdAt) }}</span>
              </div>
              <div class="msg-body">{{ msg.body }}</div>
            </div>
          </div>
        </template>
      </div>

      <!-- Right Sidebar -->
      <div class="member-sidebar">
        <h3 class="sidebar-title">群成员 ({{ group?.memberCount || 0 }})</h3>
        <div class="member-list">
          <div v-for="member in group?.members || []" :key="member.userId"
               :class="['member-item', { 'is-admin': member.role === 'admin' }]"
               @click="showUserProfile($event, member.userId)"
               @contextmenu="onMemberContextMenu($event, member)">
            <div class="member-avatar" :style="{ background: avatarColor(member.userId) }">{{ member.username.charAt(0) }}</div>
            <span class="member-name">{{ member.username }}</span>
            <span v-if="member.role === 'admin'" class="admin-badge">群主</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="input-area">
      <div class="func-buttons">
        <button class="func-btn" @click="showChainModal = true" title="滚雪球 - 发起故事接龙"><span class="func-icon">&#x1F3D4;</span> 滚雪球</button>
        <button class="func-btn" @click="showBattleModal = true" title="打雪仗 - 发起写作擂台"><span class="func-icon">&#x2744;</span> 打雪仗</button>
        <div v-if="quoteTarget" class="quote-bar">回复 {{ quoteTarget.senderName }}: <span class="quote-preview">{{ quoteTarget.body?.substring(0, 50) }}...</span><button class="quote-cancel" @click="quoteTarget = null">✕</button></div>
        <div class="func-spacer"></div>
      </div>
      <div class="input-row">
        <input v-model="inputText" type="text" class="chat-input" placeholder="输入消息..." @keydown="onInputKeydown" />
        <button class="btn-send" @click="sendMessage" :disabled="isSending || !inputText.trim()">发送</button>
      </div>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <div v-if="contextMenu.show" class="context-overlay" @click="closeContextMenu">
        <div class="context-menu" :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }" @click.stop>
          <div class="context-item" @click="copyMessageText()">复制文本</div>
          <div class="context-item" @click="quoteMessage()">引用回复</div>
          <div v-if="contextMenu.message && canDeleteMessage(contextMenu.message)" class="context-item context-danger" @click="deleteMessage()">删除消息</div>
        </div>
      </div>
    </Teleport>

    <!-- User Profile Popup -->
    <Teleport to="body">
      <div v-if="profilePopup.show" class="profile-overlay" @click="closeProfilePopup">
        <div class="profile-popup" :style="{ left: profilePopup.x + 'px', top: profilePopup.y + 'px' }" @click.stop>
          <div v-if="profilePopup.loading" class="profile-loading">加载中...</div>
          <template v-else-if="profilePopup.user">
            <div class="profile-header">
              <div class="profile-avatar-big" :style="{ background: avatarColor(profilePopup.user.user.id) }">{{ profilePopup.user.user.username.charAt(0) }}</div>
              <div><div class="profile-username">{{ profilePopup.user.user.username }}</div><div class="profile-role">{{ profilePopup.user.user.role || '用户' }}</div></div>
            </div>
            <!-- Action buttons -->
            <div class="profile-actions" v-if="profilePopup.user.user.id !== currentUserId">
              <button class="profile-action-btn" @click="router.push('/profile/' + profilePopup.user.user.id); closeProfilePopup()">👤 个人主页</button>
              <button class="profile-action-btn" @click="router.push('/chat/' + profilePopup.user.user.id); closeProfilePopup()">💬 私聊</button>
              <button class="profile-action-btn" @click="friendStore.sendRequest(profilePopup.user.user.id, 'GROUP', groupId); closeProfilePopup()">➕ 加好友</button>
            </div>
            <div class="profile-section" v-if="profilePopup.user.posts.length > 0">
              <div class="profile-section-title">最近帖子</div>
              <div v-for="post in profilePopup.user.posts.slice(0, 3)" :key="post.id" class="profile-post"><span class="profile-post-title">{{ post.title }}</span><span class="profile-post-date">{{ formatDate(post.createdAt) }}</span></div>
            </div>
            <div v-else class="profile-empty">暂无帖子</div>
          </template>
        </div>
      </div>
    </Teleport>

    <!-- Chain Create Modal -->
    <Teleport to="body">
      <div v-if="showChainModal" class="modal-overlay" @click.self="showChainModal = false">
        <div class="modal-card"><h3>发起故事接龙</h3>
          <input v-model="chainTitle" class="form-input" placeholder="接龙标题" />
          <textarea v-model="chainFirstBody" class="form-textarea" rows="5" placeholder="写下精彩的开头..."></textarea>
          <label class="field-label">截止时间 (可选，到期后不可再续写)</label>
          <input v-model="chainDeadline" type="datetime-local" class="form-input" />
          <div class="modal-actions"><button class="btn-cancel" @click="showChainModal = false">取消</button><button class="btn-submit" @click="createChain" :disabled="chainSubmitting || !chainTitle.trim() || !chainFirstBody.trim()">{{ chainSubmitting ? '发起中...' : '发起接龙' }}</button></div>
        </div>
      </div>
    </Teleport>

    <!-- Battle Create Modal -->
    <Teleport to="body">
      <div v-if="showBattleModal" class="modal-overlay" @click.self="showBattleModal = false">
        <div class="modal-card"><h3>发起写作擂台</h3>
          <label class="field-label">主题</label><input v-model="battleTopic" class="form-input" placeholder="擂台主题" />
          <label class="field-label">规则说明</label><textarea v-model="battleDesc" class="form-textarea" rows="3" placeholder="比赛规则..."></textarea>
          <label class="field-label">截止时间</label><input v-model="battleDeadline" type="datetime-local" class="form-input" />
          <label class="field-label">指定参赛者</label>
          <div class="participant-list">
            <label v-for="m in group?.members || []" :key="m.userId" class="participant-item">
              <input type="checkbox" :checked="battleParticipants.includes(m.userId)" @change="toggleBattleParticipant(m.userId)" />
              <span>{{ m.username }}</span>
            </label>
          </div>
          <div class="modal-actions"><button class="btn-cancel" @click="showBattleModal = false">取消</button><button class="btn-submit" @click="createBattle" :disabled="battleSubmitting || !battleTopic.trim()">{{ battleSubmitting ? '发起中...' : '发起擂台' }}</button></div>
        </div>
      </div>
    </Teleport>

    <!-- Battle Entry Modal -->
    <Teleport to="body">
      <div v-if="showBattleEntryModal" class="modal-overlay" @click.self="showBattleEntryModal = false">
        <div class="modal-card"><h3>提交参赛作品</h3>
          <label class="field-label">作品标题</label><input v-model="battleEntryTitle" class="form-input" placeholder="作品标题" />
          <label class="field-label">作品内容</label><textarea v-model="battleEntryBody" class="form-textarea" rows="8" placeholder="在这里挥洒您的文采..."></textarea>
          <div class="modal-actions"><button class="btn-cancel" @click="showBattleEntryModal = false">取消</button><button class="btn-submit" @click="submitBattleEntry" :disabled="battleEntrySubmitting || !battleEntryTitle.trim() || !battleEntryBody.trim()">{{ battleEntrySubmitting ? '提交中...' : '提交作品' }}</button></div>
        </div>
      </div>
    </Teleport>

    <!-- Review Modal -->
    <Teleport to="body">
      <div v-if="showReviewModal" class="modal-overlay" @click.self="showReviewModal = false">
        <div class="modal-card"><h3>评分与评论</h3>
          <label class="field-label">评分 (1-10)</label>
          <div class="score-row">
            <input v-model.number="reviewScore" type="range" min="1" max="10" class="score-slider" />
            <span class="score-value">{{ reviewScore }} / 10</span>
          </div>
          <label class="field-label">评语（可选）</label><textarea v-model="reviewComment" class="form-textarea" rows="3" placeholder="说说你的看法..."></textarea>
          <div class="modal-actions"><button class="btn-cancel" @click="showReviewModal = false">取消</button><button class="btn-submit" @click="submitReview" :disabled="reviewSubmitting">{{ reviewSubmitting ? '提交中...' : '提交评审' }}</button></div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.group-detail { display: flex; flex-direction: column; height: calc(100vh - 64px); max-width: 1100px; margin: 0 auto; }
.group-header { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: #fff; border-bottom: 1px solid #e8eaed; flex-shrink: 0; }
.btn-back { display: flex; align-items: center; background: none; border: none; color: #5f6368; cursor: pointer; padding: 6px; border-radius: 6px; transition: all 0.2s; }
.btn-back:hover { color: #1a73e8; background: #e8f0fe; }
.group-header-info { display: flex; align-items: baseline; gap: 12px; }
.group-name { font-size: 18px; font-weight: 600; color: #202124; margin: 0; }
.group-meta { font-size: 13px; color: #999; }
.header-spacer { flex: 1; }
.group-body { display: flex; flex: 1; overflow: hidden; }

/* Message Area */
.message-area { flex: 1; overflow-y: auto; padding: 20px; background: #f8f9fa; }
.empty-chat { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #999; }
.empty-icon { font-size: 48px; margin-bottom: 12px; }

/* ===== Activity Cards ===== */
.activity-card { background: #fff; border-radius: 12px; padding: 16px 20px; margin-bottom: 14px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-left: 4px solid #1a73e8; transition: transform 0.15s, box-shadow 0.15s; }
.activity-card:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
.chain-card { border-left-color: #1a73e8; }
.battle-card { border-left-color: #d93025; }
.ac-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.ac-badge { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 12px; }
.chain-badge { background: #e8f0fe; color: #1a73e8; }
.battle-badge { background: #fce8e6; color: #d93025; }
.ac-sender { font-size: 13px; color: #5f6368; }
.ac-time { font-size: 11px; color: #bdc1c6; margin-left: auto; }
.ac-body { }
.ac-title { font-size: 15px; font-weight: 600; color: #202124; }
.ac-hint { font-size: 12px; color: #1a73e8; margin-top: 6px; }

/* ===== Expand Panel ===== */
.expand-panel { margin-top: 14px; padding-top: 14px; border-top: 1px solid #e8eaed; cursor: default; max-height: 500px; overflow-y: auto; }
.expand-loading { text-align: center; color: #999; padding: 20px; font-size: 13px; }
.expand-title { font-size: 17px; font-weight: 700; color: #202124; margin: 0 0 12px 0; }
.expand-empty { text-align: center; color: #999; padding: 20px; font-size: 13px; }

/* Chain timeline */
.chain-timeline { position: relative; padding-left: 20px; border-left: 2px solid #e8eaed; margin-bottom: 14px; }
.chain-segment { position: relative; margin-bottom: 14px; padding-left: 16px; }
.seg-dot { position: absolute; left: -26px; top: 6px; width: 10px; height: 10px; border-radius: 50%; background: #1a73e8; }
.seg-header { display: flex; gap: 8px; align-items: baseline; margin-bottom: 4px; }
.seg-author { font-size: 13px; font-weight: 500; color: #1a73e8; cursor: pointer; }
.seg-time { font-size: 11px; color: #bdc1c6; }
.seg-body { font-size: 14px; color: #202124; line-height: 1.7; white-space: pre-wrap; }
.chain-input-row { display: flex; gap: 8px; align-items: flex-end; }
.chain-textarea { flex: 1; padding: 10px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; outline: none; resize: vertical; font-family: inherit; min-height: 60px; }
.chain-textarea:focus { border-color: #1a73e8; }
.btn-submit-sm { padding: 8px 18px; background: #1a73e8; color: #fff; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.btn-submit-sm:hover:not(:disabled) { background: #1557b0; }
.btn-submit-sm:disabled { background: #a8c7fa; cursor: not-allowed; }

/* Battle */
.battle-desc { font-size: 14px; color: #5f6368; margin-bottom: 10px; }
.battle-meta { display: flex; gap: 20px; font-size: 13px; color: #5f6368; margin-bottom: 12px; }
.battle-actions { margin-bottom: 12px; }
.battle-entries { display: flex; flex-direction: column; gap: 14px; }
.battle-entry { background: #f8f9fa; border-radius: 8px; padding: 14px; }
.entry-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
.entry-author { font-size: 13px; font-weight: 500; color: #1a73e8; cursor: pointer; }
.entry-title { font-size: 14px; font-weight: 600; color: #202124; }
.entry-score { font-size: 12px; color: #f9ab00; }
.entry-body { font-size: 14px; color: #202124; line-height: 1.7; white-space: pre-wrap; margin-bottom: 10px; }
.entry-reviews { border-top: 1px solid #e8eaed; padding-top: 8px; margin-bottom: 8px; }
.review-item { display: flex; gap: 8px; align-items: baseline; padding: 3px 0; font-size: 12px; flex-wrap: wrap; }
.review-author { font-weight: 500; color: #5f6368; }
.review-score { color: #f9ab00; }
.review-comment { color: #5f6368; }
.btn-review-sm { padding: 4px 12px; background: none; border: 1px solid #dadce0; border-radius: 6px; font-size: 12px; color: #5f6368; cursor: pointer; }
.btn-review-sm:hover { background: #f1f3f4; }

/* System message */
.message-row.is-system { justify-content: center; margin-bottom: 10px; }
.system-msg { font-size: 13px; color: #5f6368; background: #e8eaed; padding: 4px 14px; border-radius: 12px; }
.system-sender { font-weight: 500; color: #202124; }
.system-time { margin-left: 8px; color: #999; font-size: 12px; }

/* Normal chat message */
.message-row { display: flex; gap: 10px; margin-bottom: 16px; align-items: flex-start; }
.message-row.is-mine { flex-direction: row-reverse; }
.msg-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; font-weight: 600; flex-shrink: 0; cursor: pointer; }
.msg-content { max-width: 65%; }
.msg-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
.msg-sender { font-size: 13px; font-weight: 500; color: #5f6368; cursor: pointer; }
.msg-sender:hover { color: #1a73e8; }
.msg-time { font-size: 11px; color: #bdc1c6; }
.msg-body { background: #fff; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.6; color: #202124; word-break: break-word; white-space: pre-wrap; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.message-row.is-mine .msg-body { background: #e8f0fe; }

/* Sidebar */
.member-sidebar { width: 200px; background: #fff; border-left: 1px solid #e8eaed; padding: 16px; overflow-y: auto; flex-shrink: 0; }
.sidebar-title { font-size: 14px; font-weight: 600; color: #202124; margin: 0 0 12px 0; }
.member-list { display: flex; flex-direction: column; gap: 4px; }
.member-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; cursor: pointer; transition: background 0.15s; }
.member-item:hover { background: #f1f3f4; }
.member-avatar { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 600; flex-shrink: 0; }
.member-name { font-size: 13px; color: #202124; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-badge { font-size: 10px; background: #fce8e6; color: #d93025; padding: 1px 6px; border-radius: 8px; flex-shrink: 0; }

/* Input */
.input-area { background: #fff; border-top: 1px solid #e8eaed; padding: 8px 20px 14px; flex-shrink: 0; }
.func-buttons { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.func-btn { display: flex; align-items: center; gap: 4px; padding: 5px 12px; border: 1px solid #dadce0; border-radius: 16px; background: #fff; font-size: 13px; color: #5f6368; cursor: pointer; transition: all 0.2s; }
.func-btn:hover { background: #e8f0fe; color: #1a73e8; border-color: #1a73e8; }
.func-icon { font-size: 14px; }
.quote-bar { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #5f6368; background: #f1f3f4; padding: 3px 10px; border-radius: 8px; max-width: 400px; }
.quote-preview { color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.quote-cancel { background: none; border: none; color: #999; cursor: pointer; font-size: 14px; padding: 0 2px; }
.quote-cancel:hover { color: #d93025; }
.func-spacer { flex: 1; }
.input-row { display: flex; gap: 8px; }
.chat-input { flex: 1; padding: 10px 14px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; }
.chat-input:focus { border-color: #1a73e8; }
.btn-send { padding: 10px 20px; background: #1a73e8; color: #fff; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 500; transition: background 0.2s; }
.btn-send:hover:not(:disabled) { background: #1557b0; }
.btn-send:disabled { background: #a8c7fa; cursor: not-allowed; }

/* Context menu */
.context-overlay { position: fixed; inset: 0; z-index: 3000; }
.context-menu { position: fixed; z-index: 3001; background: #fff; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); min-width: 120px; padding: 4px 0; }
.context-item { padding: 8px 16px; font-size: 13px; color: #202124; cursor: pointer; transition: background 0.1s; }
.context-item:hover { background: #f1f3f4; }
.context-danger { color: #d93025; }
.context-danger:hover { background: #fce8e6; }

/* Profile popup */
.profile-overlay { position: fixed; inset: 0; z-index: 2500; }
.profile-popup { position: fixed; z-index: 2501; background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); padding: 20px; min-width: 260px; max-width: 320px; }
.profile-loading { text-align: center; color: #999; padding: 20px; font-size: 13px; }
.profile-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.profile-avatar-big { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; font-weight: 600; flex-shrink: 0; }
.profile-username { font-size: 16px; font-weight: 600; color: #202124; }
.profile-role { font-size: 12px; color: #999; }
.profile-actions { display: flex; gap: 8px; margin-bottom: 10px; }
.profile-action-btn {
  flex: 1; padding: 6px 10px; background: #f1f3f4; border: none;
  border-radius: 6px; cursor: pointer; font-size: 12px; transition: background 0.15s;
}
.profile-action-btn:hover { background: #e8f0fe; color: #1a73e8; }
.profile-section { margin-top: 8px; }
.profile-section-title { font-size: 12px; font-weight: 500; color: #5f6368; margin-bottom: 6px; }
.profile-post { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f3f4; font-size: 13px; }
.profile-post-title { color: #202124; }
.profile-post-date { color: #999; font-size: 11px; }
.profile-empty { font-size: 12px; color: #999; text-align: center; padding: 10px 0; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.25); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; }
.modal-card { background: #fff; border-radius: 16px; padding: 28px 30px; width: 500px; max-width: 90vw; max-height: 80vh; overflow-y: auto; box-shadow: 0 16px 48px rgba(0,0,0,0.15); }
.modal-card h3 { margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #202124; }
.field-label { display: block; font-size: 13px; font-weight: 500; color: #5f6368; margin: 14px 0 6px 0; }
.form-input { width: 100%; padding: 10px 14px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; outline: none; box-sizing: border-box; font-family: inherit; }
.form-input:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,0.08); }
.form-textarea { width: 100%; padding: 10px 14px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; outline: none; resize: vertical; box-sizing: border-box; font-family: inherit; }
.form-textarea:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,0.08); }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; }
.btn-cancel { padding: 10px 22px; border: 1px solid #dadce0; background: #fff; color: #5f6368; border-radius: 8px; font-size: 14px; cursor: pointer; }
.btn-cancel:hover { background: #f1f3f4; }
.btn-submit { padding: 10px 26px; border: none; background: #1a73e8; color: #fff; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }
.btn-submit:hover:not(:disabled) { background: #1557b0; }
.btn-submit:disabled { background: #a8c7fa; cursor: not-allowed; }

/* Participant selector */
.participant-list { max-height: 150px; overflow-y: auto; border: 1px solid #dadce0; border-radius: 8px; padding: 8px; }
.participant-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 13px; cursor: pointer; }
.participant-item input { cursor: pointer; }

/* Score slider */
.score-row { display: flex; align-items: center; gap: 12px; }
.score-slider { flex: 1; }
.score-value { font-size: 16px; font-weight: 600; color: #1a73e8; min-width: 60px; }

.expired-tag {
  color: #d93025;
  background: #fce8e6;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}
.expired-notice {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 12px;
  background: #f1f3f4;
  border-radius: 6px;
  margin-top: 8px;
}
</style>
