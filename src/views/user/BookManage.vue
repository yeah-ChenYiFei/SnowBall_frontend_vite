<!-- src/views/user/BookManage.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import http from '@/api/http'
import type { Book } from '@/types'

const books = ref<Book[]>([])
const isLoading = ref(false)
const message = ref('')

// 弹窗与表单控制
const showModal = ref(false)
const isEditing = ref(false)
const currentBookId = ref<number | null>(null)

const bookForm = ref({
  title: '',
  author: '',
  price: 0,
  purchaseDate: ''
})

// 加载图书列表
const loadBooks = async () => {
  isLoading.value = true
  try {
    const res = await http.get('/books')
    books.value = res.data || []
  } catch (error: any) {
    message.value = '加载图书失败: ' + error.message
  } finally {
    isLoading.value = false
  }
}

// 打开新增弹窗
const openCreateModal = () => {
  isEditing.value = false
  currentBookId.value = null
  bookForm.value = { title: '', author: '', price: 0, purchaseDate: '' }
  showModal.value = true
}

// 打开编辑弹窗
const openEditModal = (book: Book) => {
  isEditing.value = true
  currentBookId.value = book.id
  bookForm.value = {
    title: book.title,
    author: book.author,
    price: book.price,
    purchaseDate: book.purchaseDate ? book.purchaseDate.split('T')[0] : ''
  }
  showModal.value = true
}

// 提交表单（新增或编辑）
const handleSubmit = async () => {
  if (!bookForm.value.title || !bookForm.value.author) {
    alert('书名和作者不能为空')
    return
  }

  try {
    if (isEditing.value && currentBookId.value) {
      await http.put(`/books/${currentBookId.value}`, bookForm.value)
      message.value = '✅ 图书修改成功'
    } else {
      await http.post('/books', bookForm.value)
      message.value = '✅ 图书添加成功'
    }
    showModal.value = false
    await loadBooks()
    setTimeout(() => message.value = '', 3000)
  } catch (error: any) {
    alert('操作失败: ' + error.message)
  }
}

// 删除图书
const handleDelete = async (id: number) => {
  if (!confirm('确定要删除这本图书记录吗？')) return

  try {
    await http.delete(`/books/${id}`)
    message.value = '✅ 已删除'
    await loadBooks()
    setTimeout(() => message.value = '', 3000)
  } catch (error: any) {
    alert('删除失败: ' + error.message)
  }
}

onMounted(() => {
  loadBooks()
})
</script>

<template>
  <div class="book-manage-page">
    <div class="page-header">
      <h1>📚 我的图书管理</h1>
      <button class="btn-add" @click="openCreateModal">+ 添加新书</button>
    </div>

    <div v-if="message" class="alert alert-success">{{ message }}</div>

    <div v-if="isLoading" class="loading">加载中...</div>

    <!-- 图书表格 -->
    <div v-else-if="books.length > 0" class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>书名</th>
            <th>作者</th>
            <th>价格 (¥)</th>
            <th>购入日期</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="book in books" :key="book.id">
            <td class="td-title">{{ book.title }}</td>
            <td>{{ book.author }}</td>
            <td>¥{{ book.price.toFixed(2) }}</td>
            <td>{{ book.purchaseDate ? new Date(book.purchaseDate).toLocaleDateString() : '-' }}</td>
            <td class="td-actions">
              <button class="btn-icon edit" @click="openEditModal(book)">✏️</button>
              <button class="btn-icon delete" @click="handleDelete(book.id)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="empty-state">
      还没有记录，点击右上角添加你的第一本书吧！
    </div>

    <!-- 新增/编辑弹窗遮罩 -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ isEditing ? '编辑图书' : '添加新书' }}</h2>
          <button class="btn-close" @click="showModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>书名 *</label>
            <input v-model="bookForm.title" type="text" placeholder="请输入书名" />
          </div>
          <div class="form-group">
            <label>作者 *</label>
            <input v-model="bookForm.author" type="text" placeholder="请输入作者" />
          </div>
          <div class="form-group">
            <label>价格</label>
            <input v-model.number="bookForm.price" type="number" step="0.01" min="0" placeholder="0.00" />
          </div>
          <div class="form-group">
            <label>购入日期</label>
            <input v-model="bookForm.purchaseDate" type="date" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showModal = false">取消</button>
          <button class="btn-confirm" @click="handleSubmit">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.book-manage-page { max-width: 1000px; margin: 0 auto; padding: 40px 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid #e8eaed; padding-bottom: 16px; }
.page-header h1 { margin: 0; color: #202124; }
.btn-add { padding: 10px 20px; background: #1a73e8; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; }
.btn-add:hover { background: #1557b0; }

.alert-success { padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; background: #e6f4ea; color: #1e8e3e; border: 1px solid #ceead6; }
.loading { text-align: center; padding: 40px; color: #666; }
.empty-state { text-align: center; padding: 60px; color: #999; background: #fff; border-radius: 8px; }

/* 表格样式 */
.table-container { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 14px 16px; text-align: left; border-bottom: 1px solid #e8eaed; font-size: 14px; }
.data-table th { background: #f8f9fa; color: #5f6368; font-weight: 600; }
.data-table tr:hover { background: #fafbff; }
.td-title { font-weight: 500; color: #202124; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-actions { white-space: nowrap; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px 8px; border-radius: 4px; }
.btn-icon.edit:hover { background: #e8f0fe; }
.btn-icon.delete:hover { background: #fce8e6; }

/* 弹窗样式 */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: #fff; border-radius: 12px; width: 90%; max-width: 480px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #e8eaed; }
.modal-header h2 { margin: 0; font-size: 18px; color: #202124; }
.btn-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #5f6368; line-height: 1; }
.btn-close:hover { color: #202124; }
.modal-body { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.form-group label { display: block; font-size: 13px; font-weight: 500; color: #5f6368; margin-bottom: 6px; }
.form-group input {
  width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 6px;
  font-size: 14px; outline: none; box-sizing: border-box;
}
.form-group input:focus { border-color: #1a73e8; }
.modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; border-top: 1px solid #e8eaed; background: #f8f9fa; border-radius: 0 0 12px 12px; }
.btn-cancel { padding: 8px 20px; background: #fff; border: 1px solid #dadce0; border-radius: 6px; cursor: pointer; font-size: 14px; }
.btn-confirm { padding: 8px 24px; background: #1a73e8; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; }
.btn-confirm:hover { background: #1557b0; }
</style>
