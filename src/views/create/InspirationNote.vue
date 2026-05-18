<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useInspirationStore } from '@/stores/inspiration'
import type { Inspiration } from '@/types'

const store = useInspirationStore()

// ---- view state ----
type View = 'bubbles' | 'timeline'
const view = ref<View>('bubbles')

// ---- create modal ----
const showCreateModal = ref(false)
const newContent = ref('')
const isSubmitting = ref(false)

// ---- edit modal ----
const showEditModal = ref(false)
const editingId = ref<number>(0)
const editingContent = ref('')

// ---- timeline ----
const groupMode = ref<'day' | 'month'>('day')
const timelineReady = ref(false)
const visibleGroupCount = ref(0)

// ---- helpers ----
function formatBubbleDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const M = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${y}年${M}月${day}日${h}时${m}分，你说……`
}

function formatGroupLabel(key: string): string {
  const [y, m, d] = key.split('-')
  if (groupMode.value === 'day') return `${y}年${m}月${d}日`
  return `${y}年${m}月`
}

function formatTimelineDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const groupedInspirations = computed(() => {
  const map = new Map<string, Inspiration[]>()
  for (const item of store.inspirations) {
    const d = new Date(item.createdAt)
    const key =
      groupMode.value === 'day'
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return [...map.entries()]
})

const scrollDuration = computed(() => {
  const n = store.inspirations.length
  if (n <= 1) return 12
  return Math.max(n * 5, 12)
})

// For bubble duplication: we need at least some content to fill the view
const bubbleList = computed(() => store.inspirations)

// ---- actions ----
async function openTimeline() {
  view.value = 'timeline'
  timelineReady.value = false
  visibleGroupCount.value = 0
  await nextTick()
  // Staggered reveal
  timelineReady.value = true
  const total = groupedInspirations.value.length
  for (let i = 0; i < total; i++) {
    setTimeout(() => {
      visibleGroupCount.value = i + 1
    }, 150 * (i + 1))
  }
}

function backToBubbles() {
  view.value = 'bubbles'
}

function openCreateModal() {
  newContent.value = ''
  showCreateModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
  newContent.value = ''
}

async function submitInspiration() {
  const content = newContent.value.trim()
  if (!content) return
  isSubmitting.value = true
  await store.add(content)
  isSubmitting.value = false
  closeCreateModal()
}

function openEditModal(item: Inspiration) {
  editingId.value = item.id
  editingContent.value = item.content
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  editingId.value = 0
  editingContent.value = ''
}

async function saveEdit() {
  const content = editingContent.value.trim()
  if (!content || !editingId.value) return
  await store.update(editingId.value, content)
  closeEditModal()
}

async function deleteInspiration() {
  if (!editingId.value) return
  await store.remove(editingId.value)
  closeEditModal()
}
</script>

<template>
  <div class="inspiration-page">
    <!-- ==================== BUBBLE VIEW ==================== -->
    <template v-if="view === 'bubbles'">
      <div class="bubble-stage">
        <div
          v-if="bubbleList.length === 0"
          class="empty-hint"
        >
          <div class="empty-icon">✨</div>
          <div class="empty-text">还没有灵感，点击下方按钮记录第一个吧</div>
        </div>

        <div
          v-else
          class="bubble-track"
          :style="{ animationDuration: scrollDuration + 's' }"
        >
          <!-- First copy -->
          <div
            v-for="(item, idx) in bubbleList"
            :key="item.id"
            :class="['bubble', idx % 2 === 0 ? 'bubble-left' : 'bubble-right']"
          >
            <div class="bubble-date">{{ formatBubbleDate(item.createdAt) }}</div>
            <div class="bubble-content">{{ item.content }}</div>
          </div>
          <!-- Duplicate copy for seamless loop -->
          <div
            v-for="(item, idx) in bubbleList"
            :key="'dup-' + item.id"
            :class="['bubble', idx % 2 === 0 ? 'bubble-left' : 'bubble-right']"
          >
            <div class="bubble-date">{{ formatBubbleDate(item.createdAt) }}</div>
            <div class="bubble-content">{{ item.content }}</div>
          </div>
        </div>
      </div>

      <div class="bottom-bar">
        <button class="btn-timeline" @click="openTimeline">
          <span class="btn-timeline-icon">📋</span>
          <span>往日灵感</span>
        </button>
        <button class="btn-add" @click="openCreateModal">
          <span class="btn-add-icon">+</span>
        </button>
      </div>
    </template>

    <!-- ==================== TIMELINE VIEW ==================== -->
    <template v-else>
      <div class="timeline-page">
        <div class="timeline-header">
          <button class="btn-back" @click="backToBubbles">
            <span class="back-arrow">←</span>
            <span>返回</span>
          </button>
          <div class="timeline-title">往日灵感</div>
          <div class="group-toggle">
            <button
              :class="['toggle-btn', { active: groupMode === 'day' }]"
              @click="groupMode = 'day'"
            >
              按日
            </button>
            <button
              :class="['toggle-btn', { active: groupMode === 'month' }]"
              @click="groupMode = 'month'"
            >
              按月
            </button>
          </div>
        </div>

        <div v-if="store.inspirations.length === 0" class="timeline-empty">
          暂无灵感记录
        </div>

        <div v-else class="timeline-body" :class="{ ready: timelineReady }">
          <div class="timeline-line"></div>
          <div class="timeline-groups">
            <div
              v-for="(group, gi) in groupedInspirations"
              :key="group[0]"
              class="timeline-group"
              :class="{ visible: gi < visibleGroupCount }"
            >
              <div class="timeline-dot"></div>
              <div class="timeline-group-label">{{ formatGroupLabel(group[0]) }}</div>
              <div class="timeline-cards">
                <div
                  v-for="item in group[1]"
                  :key="item.id"
                  class="timeline-card"
                  @click="openEditModal(item)"
                >
                  <div class="card-time">{{ formatTimelineDate(item.createdAt) }}</div>
                  <div class="card-text">{{ item.content }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ==================== CREATE MODAL ==================== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
          <div class="modal-card">
            <h2 class="modal-title">抓住刹那火花</h2>
            <textarea
              v-model="newContent"
              class="modal-textarea"
              placeholder="写下此刻的灵感……"
              rows="5"
              autofocus
            ></textarea>
            <div class="modal-actions">
              <button class="btn-cancel" @click="closeCreateModal">取消</button>
              <button
                class="btn-submit"
                :disabled="!newContent.trim() || isSubmitting"
                @click="submitInspiration"
              >
                记录
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ==================== EDIT MODAL ==================== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
          <div class="modal-card">
            <h2 class="modal-title">编辑灵感</h2>
            <textarea
              v-model="editingContent"
              class="modal-textarea"
              rows="5"
              autofocus
            ></textarea>
            <div class="modal-actions">
              <button class="btn-delete" @click="deleteInspiration">删除</button>
              <div class="modal-actions-right">
                <button class="btn-cancel" @click="closeEditModal">取消</button>
                <button
                  class="btn-submit"
                  :disabled="!editingContent.trim()"
                  @click="saveEdit"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* ============================
   PAGE LAYOUT
   ============================ */
.inspiration-page {
  position: fixed;
  top: 64px;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f8f9fa;
  overflow: hidden;
}

/* ============================
   BUBBLE STAGE
   ============================ */
.bubble-stage {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 80px;
  overflow: hidden;
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0, 0, 0, 0.25) 6%,
    black 14%,
    black 86%,
    rgba(0, 0, 0, 0.25) 94%,
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0, 0, 0, 0.25) 6%,
    black 14%,
    black 86%,
    rgba(0, 0, 0, 0.25) 94%,
    transparent 100%
  );
}

.bubble-track {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 20px;
  animation: float-up linear infinite;
}

@keyframes float-up {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-50%);
  }
}

/* ---- empty state ---- */
.empty-hint {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.empty-icon {
  font-size: 48px;
}
.empty-text {
  color: #9aa0a6;
  font-size: 15px;
}

/* ---- bubble ---- */
.bubble {
  max-width: 70%;
  margin-bottom: 20px;
  animation: bubble-enter 0.5s ease-out both;
}

@keyframes bubble-enter {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.bubble-left {
  align-self: flex-start;
  margin-right: auto;
  margin-left: 16px;
}

.bubble-right {
  align-self: flex-end;
  margin-left: auto;
  margin-right: 16px;
}

.bubble-date {
  font-size: 12px;
  color: #9aa0a6;
  margin-bottom: 6px;
  padding: 0 4px;
}

.bubble-left .bubble-date {
  text-align: left;
}

.bubble-right .bubble-date {
  text-align: right;
}

.bubble-content {
  padding: 12px 18px;
  border-radius: 18px;
  font-size: 15px;
  line-height: 1.6;
  color: #202124;
  word-break: break-word;
}

.bubble-left .bubble-content {
  background: #e8f0fe;
  border-bottom-left-radius: 6px;
}

.bubble-right .bubble-content {
  background: #fce8e6;
  border-bottom-right-radius: 6px;
}

/* ============================
   BOTTOM BAR
   ============================ */
.bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  background: linear-gradient(to top, #f8f9fa 60%, transparent);
  padding: 0 24px;
}

.btn-timeline {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 22px;
  background: #fff;
  border: 1px solid #dadce0;
  border-radius: 24px;
  font-size: 14px;
  color: #5f6368;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.btn-timeline:hover {
  background: #e8f0fe;
  border-color: #1a73e8;
  color: #1a73e8;
}

.btn-timeline-icon {
  font-size: 16px;
}

.btn-add {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #1a73e8;
  border: none;
  color: #fff;
  font-size: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(26, 115, 232, 0.35);
  transition: all 0.25s;
  line-height: 1;
}

.btn-add:hover {
  background: #1557b0;
  transform: scale(1.08);
  box-shadow: 0 6px 18px rgba(26, 115, 232, 0.45);
}

.btn-add:active {
  transform: scale(0.96);
}

.btn-add-icon {
  margin-top: -1px;
}

/* ============================
   TIMELINE VIEW
   ============================ */
.timeline-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e8eaed;
  background: #fff;
  flex-shrink: 0;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  font-size: 14px;
  color: #1a73e8;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  transition: background 0.2s;
}

.btn-back:hover {
  background: #e8f0fe;
}

.back-arrow {
  font-size: 16px;
}

.timeline-title {
  font-size: 18px;
  font-weight: 600;
  color: #202124;
}

.group-toggle {
  display: flex;
  background: #f1f3f4;
  border-radius: 8px;
  overflow: hidden;
}

.toggle-btn {
  padding: 6px 14px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: #5f6368;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: #1a73e8;
  color: #fff;
}

.timeline-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9aa0a6;
  font-size: 15px;
}

.timeline-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px 40px;
  position: relative;
}

.timeline-line {
  position: absolute;
  left: 52px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e8eaed;
  transform-origin: top;
  transform: scaleY(0);
  transition: transform 1.2s ease;
}

.timeline-body.ready .timeline-line {
  transform: scaleY(1);
}

.timeline-groups {
  position: relative;
}

.timeline-group {
  position: relative;
  padding-left: 72px;
  margin-bottom: 32px;
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.timeline-group.visible {
  opacity: 1;
  transform: translateY(0);
}

.timeline-dot {
  position: absolute;
  left: 44px;
  top: 8px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #1a73e8;
  border: 2px solid #fff;
  box-shadow: 0 0 0 2px #1a73e8;
}

.timeline-group-label {
  font-size: 14px;
  font-weight: 600;
  color: #202124;
  margin-bottom: 12px;
}

.timeline-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.timeline-card {
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 10px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.timeline-card:hover {
  border-color: #1a73e8;
  box-shadow: 0 2px 8px rgba(26, 115, 232, 0.1);
  transform: translateX(4px);
}

.card-time {
  font-size: 12px;
  color: #9aa0a6;
  margin-bottom: 6px;
}

.card-text {
  font-size: 14px;
  line-height: 1.5;
  color: #202124;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ============================
   MODAL
   ============================ */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  backdrop-filter: blur(4px);
}

.modal-card {
  background: #fff;
  border-radius: 16px;
  padding: 28px 24px 20px;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: #202124;
  margin: 0 0 20px 0;
  text-align: center;
}

.modal-textarea {
  width: 100%;
  border: 1px solid #dadce0;
  border-radius: 10px;
  padding: 14px;
  font-size: 15px;
  line-height: 1.6;
  color: #202124;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.modal-textarea:focus {
  outline: none;
  border-color: #1a73e8;
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.12);
}

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 18px;
}

.modal-actions-right {
  display: flex;
  gap: 12px;
  margin-left: auto;
}

.btn-cancel {
  padding: 10px 22px;
  background: #fff;
  border: 1px solid #dadce0;
  border-radius: 8px;
  font-size: 14px;
  color: #5f6368;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #f1f3f4;
}

.btn-submit {
  padding: 10px 26px;
  background: #1a73e8;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.btn-submit:hover:not(:disabled) {
  background: #1557b0;
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-delete {
  padding: 10px 22px;
  background: #fff;
  border: 1px solid #f28b82;
  border-radius: 8px;
  font-size: 14px;
  color: #c5221f;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-delete:hover {
  background: #fce8e6;
}

/* ---- modal transitions ---- */
.modal-enter-active {
  transition: opacity 0.25s ease;
}
.modal-enter-active .modal-card {
  transition: transform 0.3s ease, opacity 0.25s ease;
}
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-leave-active .modal-card {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from {
  opacity: 0;
}
.modal-enter-from .modal-card {
  transform: scale(0.92) translateY(20px);
  opacity: 0;
}
.modal-leave-to {
  opacity: 0;
}
.modal-leave-to .modal-card {
  transform: scale(0.95);
  opacity: 0;
}
</style>
