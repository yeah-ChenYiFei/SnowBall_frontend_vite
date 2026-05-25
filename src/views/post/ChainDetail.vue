<!-- src/views/ChainDetail.vue -->
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const chainId = Number(route.params.id)

interface Segment {
  id: number
  userId: number
  username?: string
  body: string
  depth: number
  isAiGenerated?: boolean
  createdAt: string
}

interface ChainDetail {
  id: number
  title: string
  creatorName?: string
  createdAt: string
  segments?: Segment[]
}

const chainData = ref<ChainDetail | null>(null)
const isLoading = ref(true)
const newSegmentBody = ref('')
const isSubmitting = ref(false)

// AI continue state
const showAiPrompt = ref(false)
const aiPrompt = ref('')
const aiLoading = ref(false)
const isAiContent = ref(false)

const sortedSegments = computed(() => {
  if (!chainData.value?.segments) return []
  return [...chainData.value.segments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
})

const lastSegmentId = computed(() => {
  const list = sortedSegments.value
  return list.length > 0 ? list[list.length - 1]?.id : null
})

const loadChain = async () => {
  isLoading.value = true
  try {
    const res = await http.get(`/chains/${chainId}`)
    chainData.value = res.data
  } catch (error) {
    console.error('加载接龙失败', error)
  } finally {
    isLoading.value = false
  }
}

const handleContinue = async (isAi = false) => {
  if (!newSegmentBody.value.trim()) {
    alert('续写内容不能为空')
    return
  }
  if (!userStore.isLogin()) {
    alert('请先登录')
    return
  }

  isSubmitting.value = true
  try {
    await http.post(`/chains/${chainId}/segments`, {
      body: newSegmentBody.value.trim(),
      prevSegmentId: lastSegmentId.value,
      isAi,
    })
    newSegmentBody.value = ''
    aiPrompt.value = ''
    showAiPrompt.value = false
    isAiContent.value = false
    await loadChain()
  } catch (error: any) {
    alert(error.message || '续写失败')
  } finally {
    isSubmitting.value = false
  }
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
    newSegmentBody.value = data.continuation
    isAiContent.value = true
  } catch (e: any) {
    alert('AI续写失败: ' + (e.message || '未知错误'))
  } finally {
    aiLoading.value = false
  }
}

onMounted(() => {
  loadChain()
})
</script>

<template>
  <div class="chain-detail-page">
    <div v-if="isLoading" class="loading">加载接龙故事中...</div>

    <template v-else-if="chainData">
      <button class="btn-back" @click="router.back()">← 返回广场</button>

      <div class="chain-header">
        <span class="type-badge chain-badge">📖 故事接龙</span>
        <h1 class="chain-title">{{ chainData?.title }}</h1>
        <p class="chain-meta">
          发起人：{{ chainData?.creatorName || '匿名' }} · {{ new Date(chainData?.createdAt || '').toLocaleString() }}
        </p>
      </div>

      <!-- 故事时间线展示 -->
      <div class="story-timeline">
        <div v-if="sortedSegments.length === 0" class="empty-state">
          这条龙还没有人续写，来做第一个续写者吧！
        </div>

        <div
          v-for="(seg, index) in sortedSegments"
          :key="seg.id"
          class="segment-card"
          :class="{ 'is-latest': index === sortedSegments.length - 1 }"
        >
          <div class="segment-line"></div>
          <div class="segment-content">
            <div class="segment-header">
              <span class="seg-index">第 {{ index + 1 }} 段</span>
              <span class="seg-author">👤 {{ seg?.username || '匿名' }}</span>
              <span v-if="seg?.isAiGenerated" class="ai-badge">🤖 AI续写</span>
              <span class="seg-time">{{ new Date(seg?.createdAt || '').toLocaleString() }}</span>
            </div>
            <div class="segment-body">
              <p v-for="(line, i) in (seg?.body || '').split('\n')" :key="i">{{ line }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 续写输入区 -->
      <div class="continue-box">
        <h3>✍️ 续写故事</h3>
        <p class="continue-hint">请接着上面的故事情节继续创作...</p>

        <div class="continue-layout">
          <!-- 左侧：正文输入 -->
          <textarea
            v-model="newSegmentBody"
            class="continue-textarea"
            rows="10"
            placeholder="展开你的想象力..."
          ></textarea>

          <!-- 右侧：AI 续写面板 -->
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
                placeholder="描述你想要的情节走向、人物发展、文风..."
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

        <div class="continue-actions">
          <button v-if="isAiContent" class="btn-submit btn-submit-ai" @click="handleContinue(true)" :disabled="isSubmitting">
            {{ isSubmitting ? '提交中...' : '✅ 提交AI续写' }}
          </button>
          <button v-else class="btn-submit" @click="handleContinue(false)" :disabled="isSubmitting">
            {{ isSubmitting ? '提交中...' : '提交续写' }}
          </button>
        </div>
      </div>
    </template>

    <div v-else class="error-state">
      <p>接龙不存在或已被删除</p>
      <router-link to="/">返回广场</router-link>
    </div>
  </div>
</template>

<style scoped>
.chain-detail-page { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
.loading, .error-state { text-align: center; padding: 60px 20px; color: #999; }
.error-state a { color: #1a73e8; }

.btn-back { background: none; border: none; color: #1a73e8; font-size: 14px; cursor: pointer; margin-bottom: 16px; padding: 0; }

.chain-header { margin-bottom: 32px; }
.type-badge { font-size: 12px; padding: 4px 10px; border-radius: 4px; background: #fce8e6; color: #d93025; }
.chain-title { font-size: 28px; font-weight: 700; color: #202124; margin: 16px 0 8px 0; }
.chain-meta { font-size: 14px; color: #5f6368; margin: 0; }

.story-timeline { margin-bottom: 40px; }
.empty-state { text-align: center; padding: 60px 20px; color: #999; background: #fff; border-radius: 8px; border: 1px dashed #dadce0; }

.segment-card { display: flex; gap: 20px; margin-bottom: 0; position: relative; }
.segment-line { width: 2px; background: #e8eaed; flex-shrink: 0; }
.segment-card.is-latest .segment-line { background: #1a73e8; }

.segment-content { background: #fff; padding: 20px 24px; border-radius: 8px; border: 1px solid #e8eaed; margin-bottom: 16px; flex: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: all 0.2s; }
.segment-card.is-latest .segment-content { border-color: #d2e3fc; box-shadow: 0 2px 8px rgba(26, 115, 232, 0.08); }

.segment-header { display: flex; gap: 16px; align-items: center; margin-bottom: 12px; font-size: 13px; color: #999; border-bottom: 1px solid #f8f9fa; padding-bottom: 8px; }
.seg-index { font-weight: 600; color: #1a73e8; }
.seg-author { color: #333; font-weight: 500; }
.ai-badge { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.seg-time { color: #999; margin-left: auto; }

.segment-body { font-size: 16px; line-height: 1.8; color: #333; margin: 0; }
.segment-body p { margin: 0 0 12px 0; }
.segment-body p:last-child { margin-bottom: 0; }

.continue-box { background: #fff; padding: 24px; border-radius: 8px; border: 2px solid #1a73e8; box-shadow: 0 4px 12px rgba(26, 115, 232, 0.1); }
.continue-box h3 { margin: 0 0 8px 0; color: #202124; font-size: 18px; }
.continue-hint { margin: 0 0 16px 0; font-size: 13px; color: #5f6368; }

.continue-layout { display: flex; gap: 16px; margin-bottom: 14px; }
.continue-textarea { flex: 1; min-width: 0; border: 1px solid #dadce0; border-radius: 6px; padding: 16px; font-size: 15px; line-height: 1.6; resize: vertical; box-sizing: border-box; outline: none; font-family: inherit; }
.continue-textarea:focus { border-color: #1a73e8; box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.1); }

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

.continue-actions { display: flex; justify-content: flex-end; gap: 10px; }
.btn-submit { padding: 10px 32px; background: #1a73e8; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; font-weight: 500; }
.btn-submit:hover:not(:disabled) { background: #1557b0; }
.btn-submit:disabled { background: #a8c7fa; cursor: not-allowed; }
.btn-submit-ai { background: linear-gradient(135deg, #059669, #10b981); }
.btn-submit-ai:hover:not(:disabled) { opacity: 0.9; }
</style>
