<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import type { World, Result } from '@/types'

const router = useRouter()

const worlds = ref<World[]>([])
const showModal = ref(false)
const isSubmitting = ref(false)
const message = ref('')

const form = ref({
  name: '',
  description: '',
  type: '',
  isPublic: true,
})

const typeOptions = ['奇幻', '科幻', '都市', '古风', '末世', '架空历史', '其他']

async function loadWorlds() {
  try {
    const res = await http.get('/worlds') as unknown as Result<World[]>
    if (res.code === 200) worlds.value = res.data
  } catch (e: any) {
    message.value = e.message || '加载失败'
  }
}

function openModal() {
  form.value = { name: '', description: '', type: '', isPublic: true }
  showModal.value = true
}

function closeModal() {
  if (isSubmitting.value) return
  showModal.value = false
}

async function handleCreate() {
  if (!form.value.name.trim()) {
    message.value = '世界名称不能为空'
    return
  }
  isSubmitting.value = true
  message.value = ''
  try {
    const res = await http.post('/worlds', form.value) as unknown as Result<World>
    if (res.code === 200) {
      showModal.value = false
      worlds.value.unshift(res.data)
    }
  } catch (e: any) {
    message.value = e.message || '创建失败'
  } finally {
    isSubmitting.value = false
  }
}

onMounted(loadWorlds)
</script>

<template>
  <div class="setting-page">
    <h1 class="page-title">设定编写</h1>
    <p class="section-label">已创建的世界</p>

    <button class="btn-add-world" @click="openModal">+ 添加全新世界</button>

    <div v-if="worlds.length === 0" class="empty-hint">尚未创建任何世界，点击上方按钮开始构建你的世界观。</div>

    <div class="world-grid">
      <div
        v-for="w in worlds"
        :key="w.id"
        class="world-card"
        @click="router.push(`/create/setting/${w.id}`)"
      >
        <div class="card-name">
          {{ w.name }}
          <span v-if="!w.isPublic" class="private-badge">🔒 私有</span>
        </div>
        <div class="card-meta">
          <span v-if="w.type" class="card-type">{{ w.type }}</span>
        </div>
        <div class="card-desc">{{ w.description || '暂无简介' }}</div>
      </div>
    </div>

    <!-- 弹窗 -->
    <transition name="modal">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal-box">
          <h2 class="modal-title">创建新世界</h2>

          <div v-if="message" class="modal-error">{{ message }}</div>

          <div class="form-row">
            <label class="form-label">新世界名称</label>
            <input
              v-model="form.name"
              type="text"
              class="form-input"
              placeholder="给你的世界起个名字"
              @keyup.enter="handleCreate"
            />
          </div>

          <div class="form-row">
            <label class="form-label">类型</label>
            <select v-model="form.type" class="form-input">
              <option value="" disabled>选择世界观类型</option>
              <option v-for="t in typeOptions" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <div class="form-row">
            <label class="form-label">简介</label>
            <textarea
              v-model="form.description"
              class="form-input form-textarea"
              rows="3"
              placeholder="简单描述这个世界的背景..."
            ></textarea>
          </div>

          <div class="form-row form-row-inline">
            <label class="form-label">公开可见</label>
            <label class="toggle-switch">
              <input v-model="form.isPublic" type="checkbox" />
              <span class="toggle-slider"></span>
              <span class="toggle-text">{{ form.isPublic ? '所有人可见' : '仅自己可见' }}</span>
            </label>
          </div>

          <div class="modal-actions">
            <button class="btn-cancel" @click="closeModal" :disabled="isSubmitting">取消</button>
            <button class="btn-create" @click="handleCreate" :disabled="isSubmitting">
              {{ isSubmitting ? '创建中...' : '创建！' }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.setting-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 20px;
}

.page-title {
  font-size: 26px;
  font-weight: 600;
  color: #202124;
  margin-bottom: 8px;
}

.section-label {
  color: #5f6368;
  font-size: 14px;
  margin-bottom: 20px;
}

/* 添加按钮 */
.btn-add-world {
  display: block;
  width: 100%;
  padding: 14px 0;
  border: 2px dashed #a8c7fa;
  background: #f0f6ff;
  color: #1a73e8;
  border-radius: 10px;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 28px;
}
.btn-add-world:hover {
  background: #e3efff;
  border-color: #1a73e8;
}

.empty-hint {
  text-align: center;
  color: #9aa0a6;
  font-size: 14px;
  padding: 40px 0;
}

/* 世界卡片网格 */
.world-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.world-card {
  background-color: #e8f0fe;
  background-image: url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='0.5' cy='0.5' r='0.5' fill='%231a73e8' fill-opacity='0.06'/%3E%3C/svg%3E");
  border: 1px solid #d2e3fc;
  border-radius: 14px;
  padding: 22px 24px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.world-card:hover {
  border-color: #1a73e8;
  box-shadow: 0 4px 16px rgba(26, 115, 232, 0.09);
  transform: translateY(-2px);
}

.card-name {
  font-size: 17px;
  font-weight: 600;
  color: #202124;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.private-badge {
  font-size: 11px;
  font-weight: 500;
  color: #5f6368;
  background: #f1f3f4;
  padding: 2px 8px;
  border-radius: 10px;
}

.card-meta {
  margin-bottom: 10px;
}

.card-type {
  display: inline-block;
  font-size: 12px;
  background: rgba(26, 115, 232, 0.1);
  color: #1a73e8;
  padding: 2px 10px;
  border-radius: 20px;
}

.card-desc {
  font-size: 13px;
  color: #5f6368;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.modal-box {
  background: #fff;
  border-radius: 16px;
  padding: 32px 36px;
  width: 440px;
  max-width: 90vw;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: #202124;
  margin-bottom: 24px;
}

.modal-error {
  background: #fce8e6;
  color: #d93025;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 16px;
}

.form-row {
  margin-bottom: 18px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #202124;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #dadce0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
}
.form-input:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.1);
}

.form-textarea {
  resize: vertical;
}

.form-row-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toggle-switch {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.toggle-switch input {
  display: none;
}

.toggle-slider {
  width: 40px;
  height: 22px;
  background: #dadce0;
  border-radius: 11px;
  position: relative;
  transition: background 0.2s;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle-switch input:checked + .toggle-slider {
  background: #1a73e8;
}

.toggle-switch input:checked + .toggle-slider::after {
  transform: translateX(18px);
}

.toggle-text {
  font-size: 13px;
  color: #5f6368;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.btn-cancel {
  padding: 10px 24px;
  border: 1px solid #dadce0;
  background: #fff;
  color: #5f6368;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.btn-cancel:hover {
  background: #f8f9fa;
}

.btn-create {
  padding: 10px 28px;
  border: none;
  background: #1a73e8;
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}
.btn-create:hover:not(:disabled) {
  background: #1557b0;
}
.btn-create:disabled {
  background: #a8c7fa;
  cursor: not-allowed;
}

/* 弹窗过渡动画 */
.modal-enter-active {
  transition: opacity 0.25s ease;
}
.modal-enter-active .modal-box {
  transition: transform 0.3s ease, opacity 0.25s ease;
}
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-leave-active .modal-box {
  transition: transform 0.2s ease, opacity 0.15s ease;
}
.modal-enter-from {
  opacity: 0;
}
.modal-enter-from .modal-box {
  transform: translateY(20px) scale(0.96);
  opacity: 0;
}
.modal-leave-to {
  opacity: 0;
}
.modal-leave-to .modal-box {
  transform: translateY(10px) scale(0.97);
  opacity: 0;
}
</style>
