<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import http from '@/api/http'
import AdminNav from '@/components/AdminNav.vue'

const articles = ref<any[]>([])
const search = ref('')
const statusFilter = ref('')
const page = ref(1)
const msg = ref('')

const fetchArticles = async () => {
  try {
    const params: any = {
      search: search.value || undefined,
      status: statusFilter.value || undefined,
      page: page.value,
    }
    const res = await http.get<any[]>('/admin/articles', { params })
    articles.value = res.data ?? []
  } catch (e: any) {
    msg.value = e.message || '加载失败'
  }
}

onMounted(fetchArticles)
watch([search, statusFilter], () => {
  page.value = 1
  fetchArticles()
})

const unpublish = async (id: number) => {
  if (!confirm('确定下架该文章？')) return
  try {
    await http.put(`/admin/articles/${id}/unpublish`)
    msg.value = '文章已下架'
    fetchArticles()
  } catch (e: any) {
    msg.value = e.message || '操作失败'
  }
}

const publish = async (id: number) => {
  if (!confirm('确定上架该文章？')) return
  try {
    await http.put(`/admin/articles/${id}/publish`)
    msg.value = '文章已上架'
    fetchArticles()
  } catch (e: any) {
    msg.value = e.message || '操作失败'
  }
}
</script>

<template>
  <div class="article-list">
    <h2>文章管理</h2>
    <AdminNav />
    <div v-if="msg" class="toast">{{ msg }}</div>
    <div class="filters">
      <input v-model="search" placeholder="搜索标题..." class="search-input" />
      <select v-model="statusFilter" class="filter-select">
        <option value="">全部状态</option>
        <option value="PUBLISHED">已发布</option>
        <option value="DRAFT">草稿</option>
        <option value="HIDDEN">已下架</option>
      </select>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>标题</th>
          <th>状态</th>
          <th>作者ID</th>
          <th>创建时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in articles" :key="a.id">
          <td>{{ a.id }}</td>
          <td>{{ a.title }}</td>
          <td>
            <span :class="a.status === 'PUBLISHED' ? 'status-pub' : a.status === 'DRAFT' ? 'status-draft' : 'status-hidden'">
              {{ a.status === 'PUBLISHED' ? '已发布' : a.status === 'DRAFT' ? '草稿' : '已下架' }}
            </span>
          </td>
          <td>{{ a.userId }}</td>
          <td>{{ a.createdAt?.substring(0, 10) }}</td>
          <td>
            <button v-if="a.status === 'PUBLISHED'" @click="unpublish(a.id)" class="action-btn unpub-btn">下架</button>
            <button v-else-if="a.status === 'HIDDEN'" @click="publish(a.id)" class="action-btn pub-btn">上架</button>
            <span v-else class="action-hint">-</span>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="pager">
      <button :disabled="page <= 1" @click="page--; fetchArticles()">上一页</button>
      <span>第 {{ page }} 页</span>
      <button @click="page++; fetchArticles()">下一页</button>
    </div>
  </div>
</template>

<style scoped>
.article-list { max-width: 960px; margin: 0 auto; }
h2 { font-size: 20px; font-weight: 500; margin-bottom: 24px; color: #202124; }
.toast { background: #e6f4ea; color: #137333; padding: 8px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
.filters { display: flex; gap: 12px; margin-bottom: 16px; }
.search-input { flex: 1; padding: 8px 12px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; }
.filter-select { padding: 8px 12px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; background: #fff; }
.data-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.data-table th { text-align: left; padding: 12px 16px; font-size: 12px; font-weight: 500; color: #5f6368; background: #f8f9fa; border-bottom: 1px solid #e8eaed; }
.data-table td { padding: 12px 16px; font-size: 13px; color: #202124; border-bottom: 1px solid #f1f3f4; }
.action-btn { padding: 4px 12px; border: 1px solid #dadce0; border-radius: 6px; font-size: 12px; cursor: pointer; background: #fff; }
.unpub-btn { color: #e37400; border-color: #fef7e0; }
.unpub-btn:hover { background: #fef7e0; }
.pub-btn { color: #137333; border-color: #e6f4ea; }
.pub-btn:hover { background: #e6f4ea; }
.action-hint { color: #dadce0; font-size: 12px; }
.status-pub { color: #137333; font-weight: 500; }
.status-draft { color: #5f6368; font-weight: 500; }
.status-hidden { color: #c5221f; font-weight: 500; }
.pager { display: flex; align-items: center; gap: 12px; margin-top: 16px; font-size: 13px; color: #5f6368; }
.pager button { padding: 6px 14px; border: 1px solid #dadce0; border-radius: 8px; background: #fff; cursor: pointer; font-size: 13px; }
.pager button:disabled { opacity: 0.4; cursor: default; }
</style>
