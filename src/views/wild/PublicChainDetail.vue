<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import type { ChainDetailFull, ChainSegmentFull } from '@/types'
import SegmentCommentDrawer from '@/components/SegmentCommentDrawer.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const chainId = Number(route.params.chainId)

const chain = ref<ChainDetailFull | null>(null)
const isLoading = ref(true)
const newBody = ref('')
const isSubmitting = ref(false)

// AI continue state
const showAiPrompt = ref(false)
const aiPrompt = ref('')
const aiLoading = ref(false)
const isAiContent = ref(false)

// Comment drawer state
const commentSegmentId = ref(0)
const showComments = ref(false)

// Scroll target
const inputRef = ref<HTMLElement | null>(null)

const isInitiator = computed(() => {
  return chain.value?.creatorId === userStore.userInfo?.id
})

const approvedSegments = computed(() => {
  if (!chain.value?.segments) return []
  return chain.value.segments.filter(s => s.status === 'APPROVED')
})

const visibleSegments = computed(() => {
  if (!chain.value?.segments) return []
  return chain.value.segments.filter(s => {
    if (s.status === 'APPROVED') return true
    if (isInitiator.value) return true
    if (s.userId === userStore.userInfo?.id) return true
    return false
  })
})

const lastSegmentId = computed(() => {
  const list = approvedSegments.value
  return list.length > 0 ? list[list.length - 1]?.id : null
})

const loadChain = async () => {
  isLoading.value = true
  try {
    const res = await http.get<ChainDetailFull>(`/chains/public/${chainId}`)
    chain.value = res.data
  } catch (e: any) {
    console.error('加载接龙失败', e)
  } finally {
    isLoading.value = false
  }
}

const handleJoin = async () => {
  if (!userStore.isLogin()) {
    alert('请先登录')
    return
  }
  await nextTick()
  inputRef.value?.scrollIntoView({ behavior: 'smooth' })
}

const handleAiContinue = async () => {
  if (!userStore.isLogin()) {
    alert('请先登录')
    return
  }
  aiLoading.value = true
  try {
    const res = await http.post('/ai/chain-continue', {
      chainId,
      prompt: aiPrompt.value || undefined,
    }, { timeout: 120000 })
    const data = res.data as { continuation: string; model: string; tokensUsed: number }
    newBody.value = data.continuation
    isAiContent.value = true
  } catch (e: any) {
    alert('AI续写失败: ' + (e.message || '未知错误'))
  } finally {
    aiLoading.value = false
  }
}

const handleSubmit = async () => {
  if (!newBody.value.trim()) {
    alert('续写内容不能为空')
    return
  }
  if (!userStore.isLogin()) {
    alert('请先登录')
    return
  }
  isSubmitting.value = true
  try {
    await http.post(`/chains/public/${chainId}/join`, {
      body: newBody.value.trim(),
      prevSegmentId: lastSegmentId.value,
      isAi: isAiContent.value,
    })
    newBody.value = ''
    aiPrompt.value = ''
    showAiPrompt.value = false
    isAiContent.value = false
    await loadChain()
  } catch (e: any) {
    alert(e.message || '提交失败')
  } finally {
    isSubmitting.value = false
  }
}

const handleReview = async (segmentId: number, status: string) => {
  try {
    await http.put(`/chains/segments/${segmentId}/review`, { status })
    await loadChain()
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

const openComments = (segmentId: number) => {
  commentSegmentId.value = segmentId
  showComments.value = true
}

const handleDeleteSegment = async (seg: ChainSegmentFull) => {
  if (!confirm('确定要删除这一段的续写吗？')) return
  try {
    await http.delete(`/chains/segments/${seg.id}`)
    await loadChain()
  } catch (e: any) {
    alert(e.message || '删除失败')
  }
}

const canDeleteSegment = (seg: ChainSegmentFull) => {
  if (!userStore.isLogin()) return false
  if (seg.userId === userStore.userInfo?.id) return true
  if (isInitiator.value) return true
  return false
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('zh-CN')
const formatDateTime = (iso: string) => new Date(iso).toLocaleString('zh-CN')

onMounted(loadChain)
</script>

<template>
  <div class="chain-detail-page">
    <div v-if="isLoading" class="loading-state">加载接龙中...</div>

    <template v-else-if="chain">
      <button class="btn-back" @click="router.push('/wild/chains')">← 返回接龙列表</button>

      <!-- Header -->
      <div class="chain-detail-header">
        <div class="header-top">
          <div>
            <h1 class="chain-title">{{ chain.title }}</h1>
            <div class="chain-initiator">
              <span class="initiator-label">发起人</span>
              <span class="initiator-name">👤 {{ chain.creatorName || '匿名' }}</span>
              <span class="chain-created">{{ formatDateTime(chain.createdAt) }}</span>
            </div>
          </div>
          <button
            v-if="userStore.isLogin() && !isInitiator"
            class="btn-join"
            @click="handleJoin"
          >
            加入接龙
          </button>
        </div>
        <p v-if="chain.description" class="chain-description">{{ chain.description }}</p>
        <div class="chain-meta-row">
          <span class="meta-item">📊 {{ chain.segments?.length || 0 }} 段</span>
          <span v-if="chain.deadline" class="meta-item meta-deadline">
            ⏰ {{ formatDate(chain.deadline) }} 截止
          </span>
          <span class="meta-item" :class="chain.status === 'FINISHED' ? 'finished' : 'ongoing'">
            {{ chain.status === 'FINISHED' ? '已完结' : '进行中' }}
          </span>
        </div>
      </div>

      <!-- Segments Timeline -->
      <div class="segments-section">
        <div v-if="visibleSegments.length === 0" class="empty-segments">
          还没有人续写，来做第一个续写者吧！
        </div>

        <div
          v-for="(seg, index) in visibleSegments"
          :key="seg.id"
          class="segment-card"
          :class="{
            'is-pending': seg.status === 'PENDING',
            'is-rejected': seg.status === 'REJECTED',
          }"
        >
          <div class="segment-line"></div>
          <div class="segment-body">
            <div class="segment-top">
              <span class="seg-index">第 {{ index + 1 }} 段</span>
              <span class="seg-author">👤 {{ seg.username || '匿名' }}</span>
              <span v-if="seg.isAiGenerated" class="ai-badge">🤖 AI续写</span>
              <span
                v-if="seg.status === 'PENDING'"
                class="seg-status pending"
              >待审核</span>
              <span
                v-else-if="seg.status === 'REJECTED'"
                class="seg-status rejected"
              >已拒绝</span>
              <span class="seg-time">{{ formatDateTime(seg.createdAt) }}</span>
            </div>

            <div class="segment-content">
              <p v-for="(line, i) in (seg.body || '').split('\n')" :key="i">{{ line }}</p>
            </div>

            <div class="segment-actions">
              <button class="seg-action-btn" @click="openComments(seg.id)">
                💬 评论 {{ seg.commentCount > 0 ? `(${seg.commentCount})` : '' }}
              </button>

              <template v-if="isInitiator && seg.status === 'PENDING'">
                <button class="seg-action-btn approve" @click="handleReview(seg.id, 'APPROVED')">
                  ✓ 通过
                </button>
                <button class="seg-action-btn reject" @click="handleReview(seg.id, 'REJECTED')">
                  ✕ 拒绝
                </button>
              </template>
              <button v-if="canDeleteSegment(seg)" class="seg-action-btn del" @click="handleDeleteSegment(seg)">
                🗑 删除
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Write Area -->
      <div v-if="userStore.isLogin()" ref="inputRef" class="write-area">
        <h3>✍️ 续写接龙</h3>
        <p class="write-hint">接着上一个人的内容继续创作...</p>
        <div class="write-layout">
          <textarea
            v-model="newBody"
            class="write-textarea"
            rows="8"
            placeholder="展开你的想象力..."
          ></textarea>
          <div class="ai-side-panel">
            <template v-if="!showAiPrompt">
              <div class="ai-side-placeholder">
                <p>需要AI帮你续写吗？</p>
                <button class="btn-ai-side" @click="showAiPrompt = true; isAiContent = false" :disabled="isSubmitting">
                  🤖 AI 接龙
                </button>
              </div>
            </template>
            <template v-else>
              <label class="ai-side-label">AI 续写提示词</label>
              <textarea
                v-model="aiPrompt"
                class="ai-side-textarea"
                rows="6"
                placeholder="描述情节走向、人物发展、文风..."
              ></textarea>
              <div class="ai-side-actions">
                <button class="btn-ai-generate-sm" @click="handleAiContinue" :disabled="aiLoading">
                  {{ aiLoading ? '生成中...' : '生成续写' }}
                </button>
                <button class="btn-ai-cancel-sm" @click="showAiPrompt = false; aiPrompt = ''">取消</button>
              </div>
            </template>
          </div>
        </div>
        <div class="write-actions">
          <button v-if="isAiContent" class="btn-submit btn-submit-ai" :disabled="!newBody.trim() || isSubmitting" @click="handleSubmit">
            {{ isSubmitting ? '提交中...' : '✅ 提交AI续写' }}
          </button>
          <button v-else class="btn-submit" :disabled="!newBody.trim() || isSubmitting" @click="handleSubmit">
            {{ isSubmitting ? '提交中...' : '提交续写' }}
          </button>
        </div>
        <p v-if="!isInitiator" class="write-notice">
          ※ 你的续写需要发起人审核通过后才会显示
        </p>
      </div>
      <div v-else class="write-login-hint">
        <router-link to="/login">登录</router-link> 后参与续写
      </div>
    </template>

    <div v-else class="error-state">
      <p>接龙不存在或已被删除</p>
      <router-link to="/wild/chains">返回接龙列表</router-link>
    </div>

    <!-- Comment Drawer -->
    <SegmentCommentDrawer
      :segment-id="commentSegmentId"
      :visible="showComments"
      @close="showComments = false"
    />
  </div>
</template>

<style scoped>
.chain-detail-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
}

.loading-state, .error-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}
.error-state a { color: #1a73e8; }

.btn-back {
  background: none; border: none; color: #1a73e8;
  font-size: 14px; cursor: pointer; margin-bottom: 16px; padding: 0;
}

/* Header */
.chain-detail-header {
  background: #fff; border-radius: 14px; padding: 28px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05); border: 1px solid #f1f3f4;
  margin-bottom: 24px;
}
.header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.chain-title { font-size: 24px; font-weight: 700; color: #202124; margin: 0 0 12px 0; }
.chain-initiator { display: flex; align-items: center; gap: 12px; font-size: 14px; color: #5f6368; }
.initiator-label { color: #999; }
.initiator-name { font-weight: 500; color: #333; }
.chain-created { color: #999; }
.chain-description { font-size: 14px; color: #5f6368; line-height: 1.6; margin: 16px 0 0; }
.chain-meta-row { display: flex; gap: 16px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f3f4; }
.meta-item { font-size: 13px; color: #5f6368; }
.meta-deadline { color: #e37400; }
.meta-item.ongoing { color: #137333; }
.meta-item.finished { color: #999; }

.btn-join {
  padding: 10px 24px; background: #1a73e8; color: #fff;
  border: none; border-radius: 8px; font-size: 14px; font-weight: 500;
  cursor: pointer; white-space: nowrap; transition: all 0.2s;
}
.btn-join:hover { background: #1557b0; }

/* Segments */
.segments-section { margin-bottom: 32px; }
.empty-segments {
  text-align: center; padding: 40px 20px; color: #999;
  background: #fff; border-radius: 8px; border: 1px dashed #dadce0;
}

.segment-card { display: flex; gap: 20px; position: relative; }
.segment-line { width: 2px; background: #e8eaed; flex-shrink: 0; }
.segment-card:last-child .segment-line { background: #1a73e8; }

.segment-body {
  background: #fff; padding: 20px 24px; border-radius: 8px;
  border: 1px solid #e8eaed; margin-bottom: 16px; flex: 1;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: all 0.2s;
}
.segment-card.is-pending .segment-body { border-color: #fef7e0; background: #fffdf5; }
.segment-card.is-rejected .segment-body { border-color: #fce8e6; background: #fefafa; opacity: 0.7; }

.segment-top {
  display: flex; gap: 14px; align-items: center; margin-bottom: 12px;
  font-size: 13px; padding-bottom: 8px; border-bottom: 1px solid #f8f9fa;
  flex-wrap: wrap;
}
.seg-index { font-weight: 600; color: #1a73e8; }
.seg-author { color: #333; font-weight: 500; }
.ai-badge { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.seg-time { color: #999; }
.seg-status { font-size: 11px; padding: 2px 8px; border-radius: 4px; }
.seg-status.pending { background: #fef7e0; color: #e37400; }
.seg-status.rejected { background: #fce8e6; color: #c5221f; }

.segment-content { font-size: 15px; line-height: 1.8; color: #333; }
.segment-content p { margin: 0 0 12px 0; }
.segment-content p:last-child { margin-bottom: 0; }

.segment-actions { display: flex; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #f8f9fa; }
.seg-action-btn {
  padding: 4px 12px; border: 1px solid #e8eaed; background: #fff;
  border-radius: 6px; font-size: 12px; color: #5f6368; cursor: pointer;
  transition: all 0.15s;
}
.seg-action-btn:hover { background: #f1f3f4; }
.seg-action-btn.approve { color: #137333; border-color: #ceead6; }
.seg-action-btn.approve:hover { background: #e6f4ea; }
.seg-action-btn.reject { color: #c5221f; border-color: #f28b82; }
.seg-action-btn.reject:hover { background: #fce8e6; }
.seg-action-btn.del { color: #d93025; border-color: #fce8e6; margin-left: auto; }
.seg-action-btn.del:hover { background: #fce8e6; }

/* Write Area */
.write-area {
  background: #fff; padding: 24px; border-radius: 12px;
  border: 2px solid #1a73e8; box-shadow: 0 4px 12px rgba(26,115,232,0.1);
}
.write-area h3 { margin: 0 0 8px 0; color: #202124; font-size: 18px; }
.write-hint { margin: 0 0 16px 0; font-size: 13px; color: #5f6368; }

.write-layout { display: flex; gap: 16px; margin-bottom: 14px; }
.write-textarea {
  flex: 1; min-width: 0; border: 1px solid #dadce0; border-radius: 8px; padding: 14px;
  font-size: 15px; line-height: 1.7; resize: vertical; box-sizing: border-box;
  outline: none; font-family: inherit;
}
.write-textarea:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,0.1); }

.ai-side-panel { width: 200px; flex-shrink: 0; display: flex; flex-direction: column; }
.ai-side-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: #f8f9fa; border: 1px dashed #dadce0; border-radius: 8px; padding: 16px; text-align: center; }
.ai-side-placeholder p { margin: 0; font-size: 13px; color: #5f6368; }
.btn-ai-side { padding: 8px 16px; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; white-space: nowrap; }
.btn-ai-side:hover:not(:disabled) { opacity: 0.9; }
.btn-ai-side:disabled { opacity: 0.5; cursor: not-allowed; }
.ai-side-label { font-size: 12px; font-weight: 500; color: #5b3e96; margin-bottom: 6px; }
.ai-side-textarea { width: 100%; flex: 1; border: 1px solid #d4bff9; border-radius: 6px; padding: 8px 10px; font-size: 13px; resize: none; box-sizing: border-box; outline: none; font-family: inherit; background: #faf8ff; min-height: 120px; }
.ai-side-textarea:focus { border-color: #7c3aed; }
.ai-side-textarea::placeholder { color: #bdc1c6; font-size: 12px; }
.ai-side-actions { display: flex; gap: 6px; margin-top: 8px; }
.btn-ai-generate-sm { flex: 1; padding: 6px 0; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 500; white-space: nowrap; }
.btn-ai-generate-sm:hover:not(:disabled) { opacity: 0.9; }
.btn-ai-generate-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ai-cancel-sm { padding: 6px 10px; background: #fff; color: #5f6368; border: 1px solid #dadce0; border-radius: 5px; cursor: pointer; font-size: 12px; white-space: nowrap; }

.write-actions { display: flex; justify-content: flex-end; gap: 10px; }
.btn-submit {
  padding: 10px 32px; background: #1a73e8; color: white;
  border: none; border-radius: 8px; font-size: 15px; cursor: pointer; font-weight: 500;
}
.btn-submit:hover:not(:disabled) { background: #1557b0; }
.btn-submit:disabled { background: #a8c7fa; cursor: not-allowed; }
.btn-submit-ai { background: linear-gradient(135deg, #059669, #10b981); }
.btn-submit-ai:hover:not(:disabled) { opacity: 0.9; }
.write-notice { font-size: 12px; color: #999; margin-top: 10px; }
.write-login-hint { text-align: center; padding: 20px; color: #999; background: #fff; border-radius: 8px; }
.write-login-hint a { color: #1a73e8; }

@media (max-width: 600px) {
  .chain-detail-page { padding: 16px; }
  .header-top { flex-direction: column; }
  .btn-join { width: 100%; }
  .write-layout { flex-direction: column; }
  .ai-side-panel { width: 100%; }
}
</style>
