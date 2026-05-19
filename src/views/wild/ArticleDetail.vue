<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import { useUserStore } from '@/stores/user'
import type { PublishedArticle, GenericComment } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const articleId = Number(route.params.id)

const article = ref<PublishedArticle | null>(null)
const isLoading = ref(true)

// Comments
const comments = ref<GenericComment[]>([])
const newComment = ref('')
const isLoadingComments = ref(false)

const typeLabel: Record<string, string> = { NOVEL: '小说', ESSAY: '散文', DIARY: '日记' }

const loadArticle = async () => {
  isLoading.value = true
  try {
    const res = await http.get<PublishedArticle>(`/articles/${articleId}`)
    article.value = res.data
  } catch { /* */ }
  finally { isLoading.value = false }
}

const loadComments = async () => {
  isLoadingComments.value = true
  try {
    const res = await http.get<GenericComment[]>('/comments', { params: { sourceType: 'ARTICLE', sourceId: articleId } })
    const list = res.data || []
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
      params: { sourceType: 'ARTICLE', sourceId: articleId },
    } as any)
    newComment.value = ''
    loadComments()
  } catch (e: any) { alert(e.message || '评论失败') }
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('zh-CN')
const formatDateTime = (iso: string) => new Date(iso).toLocaleString('zh-CN')

onMounted(() => { loadArticle(); loadComments() })
</script>

<template>
  <div class="article-detail-page">
    <div v-if="isLoading" class="loading-state">加载中...</div>

    <template v-else-if="article">
      <button class="btn-back" @click="router.push('/wild/library')">← 返回文阁</button>

      <article class="article-content">
        <div class="article-header">
          <span class="article-type" :class="article.type === 'NOVEL' ? 'novel' : 'essay'">
            {{ typeLabel[article.type] || article.type }}
          </span>
          <span class="article-words">{{ article.wordCount || 0 }} 字</span>
        </div>

        <h1 class="article-title">{{ article.title }}</h1>

        <div class="article-meta">
          <span class="meta-author" @click="router.push(`/profile/${article.userId}`)">
            👤 {{ article.authorName || '匿名' }}
          </span>
          <span class="meta-date">{{ formatDateTime(article.createdAt) }}</span>
          <span v-if="article.publishedAt" class="meta-published">发布于 {{ formatDate(article.publishedAt) }}</span>
        </div>

        <div v-if="article.worldId && article.worldName" class="article-world-link">
          📖 绑定世界：
          <a @click.prevent="router.push(`/wild/worlds/${article.worldId}`)">
            {{ article.worldName }}
          </a>
        </div>

        <div class="article-body">
          <p v-for="(line, i) in (article.body || '').split('\n')" :key="i">{{ line }}</p>
        </div>
      </article>

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
    </template>

    <div v-else class="error-state">文章不存在或未发布</div>
  </div>
</template>

<style scoped>
.article-detail-page { max-width: 800px; margin: 0 auto; padding: 28px 20px; }
.loading-state, .error-state { text-align: center; padding: 60px; color: #999; }
.btn-back { background: none; border: none; color: #1a73e8; cursor: pointer; font-size: 14px; padding: 0; margin-bottom: 16px; }

.article-content { background: #fff; border-radius: 14px; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); border: 1px solid #f1f3f4; margin-bottom: 24px; }
.article-header { display: flex; justify-content: space-between; margin-bottom: 16px; }
.article-type { font-size: 13px; padding: 4px 12px; border-radius: 6px; font-weight: 500; }
.article-type.novel { background: #fce8e6; color: #c5221f; }
.article-type.essay { background: #e6f4ea; color: #137333; }
.article-words { font-size: 13px; color: #999; }
.article-title { font-size: 28px; font-weight: 700; color: #202124; margin: 0 0 16px 0; }
.article-meta { display: flex; gap: 16px; font-size: 13px; color: #5f6368; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #f1f3f4; }
.meta-author { cursor: pointer; color: #1a73e8; font-weight: 500; }
.meta-author:hover { text-decoration: underline; }
.meta-published { color: #999; }
.article-world-link { font-size: 14px; color: #5f6368; margin-bottom: 20px; padding: 10px 14px; background: #f8f9fa; border-radius: 8px; }
.article-world-link a { color: #1a73e8; cursor: pointer; font-weight: 500; }
.article-world-link a:hover { text-decoration: underline; }
.article-body { font-size: 16px; line-height: 1.8; color: #333; }
.article-body p { margin: 0 0 16px 0; }

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
.loading-hint, .empty-hint { text-align: center; color: #999; padding: 20px 0; font-size: 14px; }
</style>
