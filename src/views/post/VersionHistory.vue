<!-- src/views/post/VersionHistory.vue -->
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import * as Diff from 'diff' // 引入 diff 库
import type { Post } from '@/types'

// 版本数据结构
interface Version {
  id: number
  versionNumber: number
  bodySnapshot: string
  changeSummary: string
  createdAt: string
}

const route = useRoute()
const router = useRouter()
const postId = Number(route.params.id)

const currentPost = ref<Post | null>(null)
const versions = ref<Version[]>([])
const selectedVersion = ref<Version | null>(null)
const isLoading = ref(true)
const isRollbacking = ref(false)
const message = ref('')

// 核心：计算 Diff 差异 HTML
const diffHtml = computed(() => {
  if (!currentPost.value || !selectedVersion.value) return ''

  const oldText = selectedVersion.value.bodySnapshot
  const newText = currentPost.value.body

  // 生成逐行差异
  const changes = Diff.diffLines(oldText, newText)

  // 将差异转换为带颜色的 HTML
  return changes.map(part => {
    const escapedValue = part.value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')

    let color = '#333'
    let bg = 'transparent'

    if (part.added) {
      color = '#137333'
      bg = '#e6f4ea'
    } else if (part.removed) {
      color = '#c5221f'
      bg = '#fce8e6'
    }

    return `<div style="background:${bg}; color:${color}; padding: 0 4px;">${escapedValue}</div>`
  }).join('')
})

const loadData = async () => {
  try {
    // 并行请求当前帖子和版本列表
    const [postRes, verRes] = await Promise.all([
      http.get(`/posts/${postId}`),
      http.get(`/posts/${postId}/versions`)
    ])
    currentPost.value = postRes.data
    versions.value = (verRes.data || []).sort((a: Version, b: Version) => b.versionNumber - a.versionNumber)
  } catch (error) {
    message.value = '加载版本数据失败'
  } finally {
    isLoading.value = false
  }
}

// 核心：回滚操作（生成新版本，而非覆盖）
const handleRollback = async () => {
  if (!selectedVersion.value || !confirm(`确定要回滚到版本 V${selectedVersion.value.versionNumber} 吗？\n这会将该版本的内容作为最新版保存，不会丢失其他历史记录。`)) return

  isRollbacking.value = true
  try {
    await http.post(`/posts/${postId}/versions/${selectedVersion.value.id}/rollback`)
    message.value = `🎉 已成功回滚至版本 V${selectedVersion.value.versionNumber}！`
    // 回滚成功后重新加载数据
    await loadData()
  } catch (error: any) {
    message.value = '回滚失败：' + (error.message || '权限不足或版本不存在')
  } finally {
    isRollbacking.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="version-page">
    <div class="page-header">
      <button class="btn-back" @click="router.back()">← 返回详情</button>
      <h1>📜 版本历史</h1>
      <p class="subtitle">类似 Git 的版本管理，每一次保存都会留下不可变的快照</p>
    </div>

    <div v-if="isLoading" class="loading">加载版本中...</div>

    <div v-else-if="message.includes('成功')" class="alert alert-success">{{ message }}</div>
    <div v-else-if="message" class="alert alert-danger">{{ message }}</div>

    <div v-if="currentPost" class="content-layout">
      <!-- 左侧：版本时间线 -->
      <div class="version-timeline">
        <div class="current-version-card">
          <div class="ver-badge current">当前版本 (V{{ currentPost.version }})</div>
          <p class="ver-summary">{{ currentPost.title }}</p>
        </div>

        <div
          v-for="ver in versions"
          :key="ver.id"
          :class="['version-card', { active: selectedVersion?.id === ver.id }]"
          @click="selectedVersion = ver"
        >
          <div class="ver-header">
            <span class="ver-badge">V{{ ver.versionNumber }}</span>
            <span class="ver-time">{{ new Date(ver.createdAt).toLocaleString() }}</span>
          </div>
          <p class="ver-summary">{{ ver.changeSummary || '无摘要' }}</p>
        </div>
      </div>

      <!-- 右侧：对比与操作面板 -->
      <div class="diff-panel">
        <div v-if="!selectedVersion" class="empty-diff">
          <span class="icon">👈</span>
          <p>请在左侧选择一个历史版本进行对比</p>
        </div>

        <div v-else>
          <div class="diff-header">
            <h3>差异对比：当前版本 vs V{{ selectedVersion.versionNumber }}</h3>
            <button
              class="btn-rollback"
              @click="handleRollback"
              :disabled="isRollbacking"
            >
              {{ isRollbacking ? '回滚中...' : '⏪ 回滚至此版本' }}
            </button>
          </div>

          <!-- 历史版本原始内容预览 -->
          <div class="snapshot-box">
            <div class="snapshot-title">历史快照内容 (V{{ selectedVersion.versionNumber }})</div>
            <pre class="snapshot-text">{{ selectedVersion.bodySnapshot }}</pre>
          </div>

          <!-- Diff 差异高亮区域 -->
          <div class="diff-box">
            <div class="snapshot-title">逐行差异对比 <span class="text-muted">(绿底新增，红底删除)</span></div>
            <div class="diff-content" v-html="diffHtml"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.version-page { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
.page-header { margin-bottom: 32px; border-bottom: 1px solid #e8eaed; padding-bottom: 16px; }
.btn-back { background: none; border: none; color: #1a73e8; cursor: pointer; font-size: 14px; padding: 0; margin-bottom: 8px; }
.page-header h1 { margin: 0 0 8px 0; color: #202124; }
.subtitle { color: #5f6368; font-size: 14px; margin: 0; }
.loading { text-align: center; padding: 40px; color: #666; }
.alert { padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; }
.alert-success { background: #e6f4ea; color: #1e8e3e; border: 1px solid #ceead6; }
.alert-danger { background: #fce8e6; color: #d93025; border: 1px solid #f28b82; }

.content-layout { display: flex; gap: 24px; align-items: flex-start; }

/* 左侧时间线 */
.version-timeline { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; max-height: 80vh; overflow-y: auto; padding-right: 12px; }
.current-version-card, .version-card {
  background: #fff; padding: 16px; border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); cursor: pointer;
  border: 2px solid transparent; transition: all 0.2s;
}
.version-card:hover { border-color: #d2e3fc; }
.version-card.active { border-color: #1a73e8; background: #f8fbff; }
.ver-badge { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px; background: #f1f3f4; color: #5f6368; }
.ver-badge.current { background: #e8f0fe; color: #1a73e8; }
.ver-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.ver-time { font-size: 12px; color: #999; }
.ver-summary { font-size: 13px; color: #333; margin: 0; line-height: 1.4; }

/* 右侧对比面板 */
.diff-panel { flex: 1; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden; }
.empty-diff { text-align: center; padding: 80px 20px; color: #999; }
.empty-diff .icon { font-size: 48px; display: block; margin-bottom: 16px; }

.diff-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #e8eaed; background: #f8f9fa; }
.diff-header h3 { margin: 0; font-size: 16px; color: #202124; }
.btn-rollback {
  padding: 8px 16px; background: #d93025; color: white; border: none;
  border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 500;
}
.btn-rollback:hover:not(:disabled) { background: #c5221f; }
.btn-rollback:disabled { background: #f28b82; cursor: not-allowed; }

.snapshot-box, .diff-box { padding: 24px; border-bottom: 1px solid #e8eaed; }
.snapshot-title { font-size: 14px; font-weight: 600; color: #202124; margin-bottom: 12px; }
.text-muted { font-weight: 400; color: #5f6368; font-size: 13px; }
.snapshot-text {
  background: #f8f9fa; padding: 16px; border-radius: 6px; font-size: 14px;
  line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; margin: 0;
  font-family: 'Courier New', Courier, monospace; color: #5f6368;
}
.diff-content {
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px; line-height: 1.6; border: 1px solid #e8eaed;
  border-radius: 6px; overflow: hidden;
}
</style>
