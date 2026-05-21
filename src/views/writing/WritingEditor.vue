<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import http from '@/api/http'
import type { ArticleType, World } from '@/types'
import { ArticleTypeLabel } from '@/types'
import {
  type SectionType,
  SectionTypeLabel,
  SectionTypeOrder,
  type ChapterInfo,
  isConfigPost,
  encodeNovelConfig,
  decodeNovelConfig,
  encodeChapter,
  decodeChapter,
  generateChapterTitle,
  toChineseNum,
} from '@/utils/chapterCodec'

const router = useRouter()
const route = useRoute()

const editId = computed(() => {
  const id = route.params.id
  if (id && id !== 'new') return Number(id)
  return null
})

const isEditMode = computed(() => editId.value !== null)

const articleType = ref<ArticleType>('ESSAY')
const title = ref('')
const chapter = ref('')
const content = ref('')
const isSubmitting = ref(false)
const message = ref('')
const isLoading = ref(false)

// Per-type state: save title/content/chapter for each type to restore when switching back
const typeStates = ref<Record<ArticleType, { title: string; content: string; chapter: string }>>({
  ESSAY: { title: '', content: '', chapter: '' },
  DIARY: { title: '', content: '', chapter: '' },
  NOVEL: { title: '', content: '', chapter: '' },
})

// ===== Novel-specific state =====
const novelPhase = ref<'create' | 'write'>('create')
const sectionType = ref<SectionType>('main')
const novelHasVolumes = ref(false)
const currentVolume = ref(1)
const currentChapter = ref(1)
const chapterTitle = ref('')
const novelChapters = ref<{ postId: number; section: SectionType; volume: number; chapter: number; title: string; body: string }[]>([])
const novelConfigId = ref<number | null>(null)

// Writing tool settings
const fontSize = ref('16')
const lineHeight = ref('1.8')
const fontFamily = ref('default')

// AI continuation
const aiOutput = ref('')
const aiLoading = ref(false)

async function handleAiContinue() {
  if (!editId.value) {
    message.value = '请先保存章节后再使用AI续写'
    return
  }
  aiLoading.value = true
  aiOutput.value = ''
  try {
    const res = await http.post('/ai/continue', { articleId: editId.value })
    const data = res.data as { continuation: string; model: string; tokensUsed: number }
    aiOutput.value = data.continuation
  } catch (e: any) {
    aiOutput.value = 'AI续写失败: ' + (e.message || '未知错误')
  } finally {
    aiLoading.value = false
  }
}

const wordCount = computed(() => content.value.length)

// Publish + bind world
const isPublished = ref(false)
const bindWorldId = ref(0)
const currentWorldId = ref<number | null>(null)
const worldName = ref('')
const accessibleWorlds = ref<World[]>([])

async function loadAccessibleWorlds() {
  try {
    const res = await http.get<World[]>('/worlds')
    accessibleWorlds.value = res.data || []
  } catch { /* */ }
}

async function togglePublish() {
  if (!editId.value) return
  try {
    const endpoint = isPublished.value
      ? `/articles/${editId.value}/unpublish`
      : `/articles/${editId.value}/publish`
    const res = await http.post(endpoint)
    const data = res.data
    isPublished.value = (data as any).isPublished
  } catch (e: any) { alert(e.message || '操作失败') }
}

async function handleBindWorld() {
  if (!editId.value || !bindWorldId.value) return
  try {
    const res = await http.put(`/articles/${editId.value}/bind-world`, { worldId: bindWorldId.value })
    const data = res.data as any
    currentWorldId.value = data.worldId
    worldName.value = data.worldName || ''
  } catch (e: any) { alert(e.message || '操作失败') }
}

async function handleUnbindWorld() {
  if (!editId.value) return
  try {
    await http.delete(`/articles/${editId.value}/bind-world`)
    currentWorldId.value = null
    worldName.value = ''
    bindWorldId.value = 0
  } catch (e: any) { alert(e.message || '操作失败') }
}

const showChapter = computed(() => articleType.value === 'NOVEL')

const types: ArticleType[] = ['ESSAY', 'DIARY', 'NOVEL']

// ===== Novel computed properties =====

// Map of "section:vol" → max chapter number in that scope
const chapterMap = computed(() => {
  const map = new Map<string, number>()
  for (const c of novelChapters.value) {
    const key = `${c.section}:${novelHasVolumes.value ? c.volume : 0}`
    const cur = map.get(key) ?? 0
    if (c.chapter > cur) map.set(key, c.chapter)
  }
  return map
})

const currentSectionVolumeKey = computed(() =>
  `${sectionType.value}:${novelHasVolumes.value ? currentVolume.value : 0}`,
)

const maxChapterInCurrentScope = computed(() =>
  chapterMap.value.get(currentSectionVolumeKey.value) ?? 0,
)

const nextChapterNumber = computed(() => maxChapterInCurrentScope.value + 1)

const existingChapterPostId = computed(() => {
  const match = novelChapters.value.find(
    (c) =>
      c.section === sectionType.value &&
      (novelHasVolumes.value ? c.volume === currentVolume.value : true) &&
      c.chapter === currentChapter.value,
  )
  return match?.postId ?? null
})

const selectableVolumes = computed(() => {
  if (!novelHasVolumes.value) return [] as number[]
  const vols: number[] = []
  let max = 0
  for (const [key] of chapterMap.value) {
    if (key.startsWith(sectionType.value + ':')) {
      const v = parseInt(key.split(':')[1], 10)
      if (v > max) max = v
    }
  }
  for (let i = 1; i <= max + 1; i++) vols.push(i)
  if (vols.length === 0) vols.push(1)
  return vols
})

const selectableChapters = computed(() => {
  const chs: number[] = []
  const max = maxChapterInCurrentScope.value
  for (let i = 1; i <= max + 1; i++) chs.push(i)
  return chs
})

const autoGeneratedTitle = computed(() =>
  generateChapterTitle(
    sectionType.value,
    novelHasVolumes.value ? currentVolume.value : 0,
    currentChapter.value,
    novelHasVolumes.value,
  ),
)

// ===== Methods =====

function selectType(type: ArticleType) {
  if (type === articleType.value) return
  typeStates.value[articleType.value] = {
    title: title.value,
    content: content.value,
    chapter: articleType.value === 'NOVEL' ? '' : chapter.value,
  }
  articleType.value = type
  const saved = typeStates.value[type]

  if (type === 'NOVEL') {
    title.value = saved.title
    content.value = ''
    chapter.value = ''
    novelPhase.value = 'create'
    novelChapters.value = []
    novelConfigId.value = null
    sectionType.value = 'main'
    novelHasVolumes.value = false
    currentVolume.value = 1
    currentChapter.value = 1
    chapterTitle.value = ''
  } else if (type === 'DIARY' && !saved.title) {
    const today = new Date()
    title.value = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 日记`
    content.value = saved.content
    chapter.value = ''
  } else {
    title.value = saved.title
    content.value = saved.content
    chapter.value = saved.chapter
  }
}

async function loadArticle() {
  if (!editId.value) return
  isLoading.value = true
  try {
    const res = await http.get(`/articles/${editId.value}`)
    const data = res.data
    articleType.value = data.type as ArticleType
    title.value = data.title
    content.value = data.body
    const ch = data.chapter || ''

    if (articleType.value === 'NOVEL') {
      chapter.value = ''
      if (isConfigPost(ch)) {
        // This is a novel config post → load all chapters and enter write phase
        const cfg = decodeNovelConfig(ch)
        if (cfg) novelHasVolumes.value = cfg.hasVolumes
        novelConfigId.value = data.id
        novelPhase.value = 'write'
        await loadNovelChapters(data.title)
        // Default to main section, first chapter
        sectionType.value = 'main'
        currentVolume.value = 1
        currentChapter.value = nextChapterNumber.value
        chapterTitle.value = autoGeneratedTitle.value
        content.value = ''
      } else if (ch) {
        // This is a chapter post → decode, load all chapters, enter write phase
        const info = decodeChapter(ch)
        sectionType.value = info.section
        novelHasVolumes.value = info.volume > 0
        currentVolume.value = info.volume || 1
        currentChapter.value = info.chapter
        chapterTitle.value = info.title
        novelPhase.value = 'write'
        await loadNovelChapters(data.title)
        // Update novelConfigId from loaded chapters
      } else {
        // Legacy NOVEL post without encoding → treat as needing creation
        novelPhase.value = 'create'
      }
    } else {
      chapter.value = ch
    }

    // Restore publish/bind state
    isPublished.value = (data as any).isPublished || false
    currentWorldId.value = (data as any).worldId || null
    worldName.value = (data as any).worldName || ''
    bindWorldId.value = (data as any).worldId || 0
  } catch (e: any) {
    message.value = e.message || '加载文章失败'
  } finally {
    isLoading.value = false
  }
}

async function handleSave() {
  if (articleType.value === 'NOVEL') return // use saveNovelChapter instead

  if (!title.value.trim() || !content.value.trim()) {
    message.value = '标题和正文不能为空！'
    return
  }

  isSubmitting.value = true
  message.value = ''

  try {
    if (isEditMode.value) {
      await http.put(`/articles/${editId.value}`, {
        title: title.value,
        body: content.value,
        chapter: showChapter.value ? chapter.value : undefined,
        changeSummary: '编辑文章',
      })
    } else {
      await http.post('/articles', {
        type: articleType.value,
        title: title.value,
        body: content.value,
        chapter: showChapter.value ? chapter.value : undefined,
      })
    }
    router.push('/writing')
  } catch (e: any) {
    message.value = e.message || '保存失败'
  } finally {
    isSubmitting.value = false
  }
}

// ===== Novel-specific methods =====

async function loadNovelChapters(bookName: string) {
  isLoading.value = true
  try {
    const res = await http.get('/articles', { params: { search: bookName, type: 'NOVEL' } })
    const allPosts = (res.data || []) as any[]

    novelChapters.value = []
    novelConfigId.value = null

    for (const post of allPosts) {
      if (post.type !== 'NOVEL') continue
      const ch = post.chapter || ''
      if (isConfigPost(ch)) {
        novelConfigId.value = post.id
        const cfg = decodeNovelConfig(ch)
        if (cfg) novelHasVolumes.value = cfg.hasVolumes
        continue
      }
      if (!ch) continue
      const info = decodeChapter(ch)
      novelChapters.value.push({
        postId: post.id,
        section: info.section,
        volume: info.volume,
        chapter: info.chapter,
        title: info.title,
        body: post.body || '',
      })
    }

    if (novelConfigId.value !== null) {
      novelPhase.value = 'write'
    }
  } catch {
    // silent
  } finally {
    isLoading.value = false
  }
}

async function createNovelBook() {
  if (!title.value.trim()) {
    message.value = '请输入书名'
    return
  }
  isSubmitting.value = true
  message.value = ''
  try {
    const res = await http.post('/articles', {
      type: 'NOVEL',
      title: title.value.trim(),
      body: '',
      chapter: encodeNovelConfig({ hasVolumes: novelHasVolumes.value }),
    })
    novelConfigId.value = res.data.id
    novelPhase.value = 'write'
    sectionType.value = 'main'
    currentVolume.value = 1
    currentChapter.value = 1
    chapterTitle.value = autoGeneratedTitle.value
    content.value = ''
  } catch (e: any) {
    message.value = e.message || '创建失败'
  } finally {
    isSubmitting.value = false
  }
}

async function saveNovelChapter() {
  if (!content.value.trim()) {
    message.value = '章节内容不能为空'
    return
  }
  isSubmitting.value = true
  message.value = ''
  try {
    const info: ChapterInfo = {
      section: sectionType.value,
      volume: novelHasVolumes.value ? currentVolume.value : 0,
      chapter: currentChapter.value,
      title: chapterTitle.value,
    }
    const encoded = encodeChapter(info)

    const existingId = existingChapterPostId.value
    if (existingId) {
      await http.put(`/articles/${existingId}`, {
        title: title.value,
        body: content.value,
        chapter: encoded,
        changeSummary: `编辑${SectionTypeLabel[sectionType.value]}章节`,
      })
    } else {
      await http.post('/articles', {
        type: 'NOVEL',
        title: title.value,
        body: content.value,
        chapter: encoded,
      })
    }
    await loadNovelChapters(title.value)
    message.value = '保存成功'

    // Advance to next chapter
    currentChapter.value = nextChapterNumber.value
    chapterTitle.value = autoGeneratedTitle.value
    content.value = ''
  } catch (e: any) {
    message.value = e.message || '保存失败'
  } finally {
    isSubmitting.value = false
  }
}

function switchSection(type: SectionType) {
  if (type === sectionType.value) return
  sectionType.value = type
  currentVolume.value = selectableVolumes.value[0] || 1
  currentChapter.value = nextChapterNumber.value
  chapterTitle.value = autoGeneratedTitle.value
  content.value = ''
}

function onVolumeChange() {
  currentChapter.value = nextChapterNumber.value
  chapterTitle.value = autoGeneratedTitle.value
  content.value = ''
}

function onChapterChange() {
  // If selecting an existing chapter, load its content
  const existing = novelChapters.value.find(
    (c) =>
      c.section === sectionType.value &&
      (novelHasVolumes.value ? c.volume === currentVolume.value : true) &&
      c.chapter === currentChapter.value,
  )
  if (existing) {
    chapterTitle.value = existing.title
    content.value = existing.body
  } else {
    chapterTitle.value = autoGeneratedTitle.value
    content.value = ''
  }
}

function getExistingTitleFor(ch: number): string {
  const existing = novelChapters.value.find(
    (c) =>
      c.section === sectionType.value &&
      (novelHasVolumes.value ? c.volume === currentVolume.value : true) &&
      c.chapter === ch,
  )
  return existing?.title || ''
}

function goBack() {
  router.push('/writing')
}

onMounted(() => {
  loadAccessibleWorlds()
  // Support ?type=DIARY etc. for direct entry from plaza
  const qType = route.query.type as string | undefined
  if (qType && ['ESSAY', 'DIARY', 'NOVEL'].includes(qType) && !isEditMode.value) {
    selectType(qType as ArticleType)
  }
  if (isEditMode.value) {
    loadArticle()
  }
})

const textareaStyle = computed(() => ({
  fontSize: fontSize.value + 'px',
  lineHeight: lineHeight.value,
  fontFamily: fontFamily.value === 'serif' ? 'Georgia, "Noto Serif SC", serif' : 'inherit',
}))
</script>

<template>
  <div class="writing-editor">
    <!-- Header -->
    <div class="editor-header">
      <button class="btn-back" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        返回
      </button>
      <h1 class="editor-title-text">
        {{ articleType === 'NOVEL' ? (novelPhase === 'create' ? '创建新小说' : '小说写作') : (isEditMode ? '编辑文章' : '新文章') }}
      </h1>
      <div class="header-spacer"></div>
      <button
        v-if="isEditMode && (articleType === 'NOVEL' || articleType === 'ESSAY')"
        class="btn-header-publish"
        :class="{ published: isPublished }"
        @click="togglePublish"
      >
        {{ isPublished ? '已发布 ✓' : '发布到文阁' }}
      </button>
    </div>

    <div v-if="isLoading" class="loading-state">加载中...</div>

    <template v-else>
      <!-- Message -->
      <div v-if="message" class="alert" :class="message.includes('成功') ? 'alert-success' : 'alert-danger'">
        {{ message }}
      </div>

      <!-- Type Selector (always visible) -->
      <div class="type-selector">
        <button
          v-for="t in types"
          :key="t"
          :class="['type-btn', { active: articleType === t }]"
          @click="selectType(t)"
        >
          {{ ArticleTypeLabel[t] }}
        </button>
      </div>

      <!-- ==================== NOVEL UI ==================== -->
      <template v-if="articleType === 'NOVEL'">

        <!-- Phase 1: Create novel book -->
        <div v-if="novelPhase === 'create'" class="novel-create">
          <div class="form-group">
            <label class="field-label">书名</label>
            <input
              v-model="title"
              type="text"
              class="form-input title-input"
              placeholder="给你的小说起个名字"
            />
          </div>

          <div class="form-group toggle-group">
            <label class="field-label">分卷</label>
            <div class="toggle-row">
              <button
                :class="['toggle-btn', { active: novelHasVolumes }]"
                @click="novelHasVolumes = !novelHasVolumes"
              >
                <span class="toggle-knob"></span>
              </button>
              <span class="toggle-label">{{ novelHasVolumes ? '分卷' : '不分卷' }}</span>
              <span class="toggle-hint">{{ novelHasVolumes ? '将按卷组织章节' : '章节将连续编号' }}</span>
            </div>
          </div>

          <div class="create-action">
            <button class="btn-create-book" @click="createNovelBook" :disabled="isSubmitting || !title.trim()">
              {{ isSubmitting ? '创建中...' : '创建这本书' }}
            </button>
          </div>
        </div>

        <!-- Phase 2: Write chapters -->
        <div v-else class="novel-write">
          <!-- Section type tabs -->
          <div class="section-tabs">
            <button
              v-for="s in SectionTypeOrder"
              :key="s"
              :class="['section-tab', { active: sectionType === s }]"
              @click="switchSection(s)"
            >
              {{ SectionTypeLabel[s] }}
            </button>
          </div>

          <div class="novel-two-col">
            <!-- Left: chapter selector + title -->
            <div class="novel-col novel-col-left">
              <div v-if="novelHasVolumes" class="selector-row">
                <label class="field-label">选择卷</label>
                <select v-model.number="currentVolume" class="form-select" @change="onVolumeChange()">
                  <option v-for="v in selectableVolumes" :key="v" :value="v">
                    第{{ toChineseNum(v) }}卷
                  </option>
                </select>
              </div>

              <div class="selector-row">
                <label class="field-label">选择章节</label>
                <select v-model.number="currentChapter" class="form-select" @change="onChapterChange()">
                  <option v-for="ch in selectableChapters" :key="ch" :value="ch">
                    第{{ toChineseNum(ch) }}章
                    <template v-if="getExistingTitleFor(ch)"> — {{ getExistingTitleFor(ch) }}</template>
                    <template v-else-if="ch > maxChapterInCurrentScope"> (新章节)</template>
                  </option>
                </select>
              </div>

              <div class="chapter-title-field">
                <label class="field-label">章节标题</label>
                <input
                  v-model="chapterTitle"
                  type="text"
                  class="form-input"
                  placeholder="可自行修改章节标题"
                />
              </div>
            </div>

            <!-- Right: bind world info -->
            <div v-if="isEditMode" class="novel-col novel-col-right">
              <div class="bound-world-card">
                <h4>📖 绑定世界</h4>
                <template v-if="currentWorldId">
                  <p class="bound-world-name">{{ worldName }}</p>
                  <a class="bound-world-link" @click.prevent="router.push(`/wild/worlds/${currentWorldId}`)">查看世界 →</a>
                  <button class="btn-unbind" @click="handleUnbindWorld">解绑</button>
                </template>
                <template v-else>
                  <p class="bound-world-hint">尚未绑定世界</p>
                  <select v-model="bindWorldId" class="bind-select" style="width:100%;margin-bottom:8px">
                    <option :value="0">选择世界...</option>
                    <option v-for="w in accessibleWorlds" :key="w.id" :value="w.id">{{ w.name }}</option>
                  </select>
                  <button class="btn-bind" @click="handleBindWorld" :disabled="bindWorldId === 0" style="width:100%">绑定</button>
                </template>
              </div>
            </div>
          </div>

          <!-- Writing Toolbar -->
          <div class="toolbar">
            <div class="toolbar-group">
              <label class="tool-label">字号</label>
              <select v-model="fontSize" class="tool-select">
                <option value="14">14px</option>
                <option value="16">16px</option>
                <option value="18">18px</option>
                <option value="20">20px</option>
              </select>
            </div>
            <div class="toolbar-group">
              <label class="tool-label">行距</label>
              <select v-model="lineHeight" class="tool-select">
                <option value="1.5">1.5</option>
                <option value="1.8">1.8</option>
                <option value="2.0">2.0</option>
                <option value="2.5">2.5</option>
              </select>
            </div>
            <div class="toolbar-group">
              <label class="tool-label">字体</label>
              <select v-model="fontFamily" class="tool-select">
                <option value="default">默认</option>
                <option value="serif">衬线</option>
              </select>
            </div>
            <div class="toolbar-spacer"></div>
            <div class="toolbar-group">
              <span class="word-count">{{ wordCount }} 字</span>
            </div>
          </div>

          <!-- Writing Area with AI Panel -->
          <div class="writing-area-row">
            <div class="writing-area">
              <textarea
                v-model="content"
                class="writing-textarea"
                :style="textareaStyle"
                placeholder="在这里挥洒您的文采..."
              ></textarea>
            </div>
            <div class="ai-panel">
              <div class="ai-panel-header">🤖 AI 续写</div>
              <div class="ai-output" :class="{ loading: aiLoading }">
                <span v-if="aiLoading" class="ai-loading-text">AI 正在续写中...</span>
                <span v-else-if="!aiOutput" class="ai-placeholder">点击下方按钮，AI 将根据绑定的世界设定和已有小说内容进行续写</span>
                <span v-else>{{ aiOutput }}</span>
              </div>
              <button
                class="ai-continue-btn"
                :disabled="aiLoading"
                @click="handleAiContinue"
              >
                {{ aiLoading ? '续写中...' : 'AI 续写' }}
              </button>
            </div>
          </div>

          <div class="editor-footer">
            <button class="btn-save" @click="saveNovelChapter" :disabled="isSubmitting">
              {{ isSubmitting ? '保存中...' : (existingChapterPostId ? '更新章节' : '保存章节') }}
            </button>
          </div>
        </div>
      </template>

      <!-- ==================== ESSAY / DIARY UI (unchanged) ==================== -->
      <template v-else>
        <!-- Chapter (NOVEL only - hidden for ESSAY/DIARY) -->

        <!-- Title -->
        <div class="title-field">
          <input
            v-model="title"
            type="text"
            class="form-input title-input"
            :placeholder="articleType === 'DIARY' ? '日记标题...' : '文章标题...'"
          />
        </div>

        <!-- Writing Toolbar -->
        <div class="toolbar">
          <div class="toolbar-group">
            <label class="tool-label">字号</label>
            <select v-model="fontSize" class="tool-select">
              <option value="14">14px</option>
              <option value="16">16px</option>
              <option value="18">18px</option>
              <option value="20">20px</option>
            </select>
          </div>
          <div class="toolbar-group">
            <label class="tool-label">行距</label>
            <select v-model="lineHeight" class="tool-select">
              <option value="1.5">1.5</option>
              <option value="1.8">1.8</option>
              <option value="2.0">2.0</option>
              <option value="2.5">2.5</option>
            </select>
          </div>
          <div class="toolbar-group">
            <label class="tool-label">字体</label>
            <select v-model="fontFamily" class="tool-select">
              <option value="default">默认</option>
              <option value="serif">衬线</option>
            </select>
          </div>
          <div class="toolbar-spacer"></div>
          <div class="toolbar-group">
            <span class="word-count">{{ wordCount }} 字</span>
          </div>
        </div>

        <!-- Writing Area -->
        <div class="writing-area">
          <textarea
            v-model="content"
            class="writing-textarea"
            :style="textareaStyle"
            placeholder="在这里挥洒您的文采..."
          ></textarea>
        </div>

        <!-- Save Button -->
        <div class="editor-footer">
          <button class="btn-save" @click="handleSave" :disabled="isSubmitting">
            {{ isSubmitting ? '保存中...' : '保存文章' }}
          </button>
          <!-- Bind world control -->
          <div v-if="isEditMode && articleType === 'NOVEL'" class="bind-world-row">
            <select v-model="bindWorldId" class="bind-select">
              <option :value="0">绑定世界（可选）</option>
              <option v-for="w in accessibleWorlds" :key="w.id" :value="w.id">{{ w.name }}</option>
            </select>
            <button class="btn-bind" @click="handleBindWorld" :disabled="bindWorldId === 0">绑定</button>
            <button v-if="currentWorldId" class="btn-unbind" @click="handleUnbindWorld">解绑</button>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.writing-editor {
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px;
}

/* Header */
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #5f6368;
  font-size: 14px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 0.2s;
}

.btn-back:hover {
  color: #1a73e8;
  background: #e8f0fe;
}

.editor-title-text {
  font-size: 20px;
  font-weight: 600;
  color: #202124;
  margin: 0;
}

.btn-header-publish {
  padding: 8px 18px; border: 1px solid #1a73e8; background: #fff;
  color: #1a73e8; border-radius: 8px; font-size: 13px; cursor: pointer;
  white-space: nowrap; transition: all 0.15s;
}
.btn-header-publish:hover { background: #e8f0fe; }
.btn-header-publish.published { background: #e6f4ea; color: #137333; border-color: #ceead6; }

.header-spacer {
  width: 70px;
}

/* Alert */
.alert {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 14px;
}

.alert-success {
  background: #e6f4ea;
  color: #1e8e3e;
  border: 1px solid #ceead6;
}

.alert-danger {
  background: #fce8e6;
  color: #d93025;
  border: 1px solid #f28b82;
}

/* Type Selector */
.type-selector {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.type-btn {
  flex: 1;
  padding: 12px 20px;
  border: 2px solid #e8eaed;
  border-radius: 10px;
  background: #ffffff;
  font-size: 15px;
  font-weight: 500;
  color: #5f6368;
  cursor: pointer;
  transition: all 0.25s;
}

.type-btn:hover {
  border-color: #a8c7fa;
  color: #1a73e8;
}

.type-btn.active {
  border-color: #1a73e8;
  background: #e8f0fe;
  color: #1a73e8;
  font-weight: 600;
}

/* Chapter Field (unused in NOVEL mode now) */
.chapter-field {
  margin-bottom: 20px;
}

.field-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #5f6368;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #dadce0;
  border-radius: 8px;
  font-size: 15px;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.08);
}

.form-select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #dadce0;
  border-radius: 8px;
  font-size: 15px;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s;
}

.form-select:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.08);
}

/* Title */
.title-field {
  margin-bottom: 16px;
}

.title-input {
  font-size: 20px;
  font-weight: 600;
  padding: 14px 16px;
}

.title-input::placeholder {
  font-weight: 400;
  color: #bdc1c6;
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: #ffffff;
  border: 1px solid #e8eaed;
  border-radius: 8px 8px 0 0;
  border-bottom: none;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-label {
  font-size: 13px;
  color: #5f6368;
  white-space: nowrap;
}

.tool-select {
  padding: 4px 8px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 13px;
  color: #202124;
  background: #fff;
  outline: none;
  cursor: pointer;
}

.tool-select:focus {
  border-color: #1a73e8;
}

.toolbar-spacer {
  flex: 1;
}

.word-count {
  font-size: 13px;
  color: #999;
  white-space: nowrap;
}

/* Writing Area */
.writing-area {
  flex: 1;
  display: flex;
}

.writing-textarea {
  width: 100%;
  min-height: 420px;
  padding: 20px;
  border: 1px solid #e8eaed;
  border-radius: 0 0 8px 8px;
  font-size: 16px;
  line-height: 1.8;
  color: #202124;
  outline: none;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.writing-textarea:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.08);
}

.writing-textarea::placeholder {
  color: #bdc1c6;
}

/* Footer */
.editor-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 28px;
  flex-wrap: wrap;
}

.btn-save {
  padding: 14px 56px;
  background: #1a73e8;
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s;
  box-shadow: 0 2px 12px rgba(26, 115, 232, 0.25);
}

.btn-save:hover:not(:disabled) {
  background: #1557b0;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(26, 115, 232, 0.35);
}

.btn-save:disabled {
  background: #a8c7fa;
  cursor: not-allowed;
  box-shadow: none;
}

.bind-world-row { display: flex; align-items: center; gap: 8px; }
.bind-select {
  padding: 8px 12px; border: 1px solid #dadce0; border-radius: 8px;
  font-size: 13px; outline: none;
}
.btn-bind {
  padding: 8px 14px; background: #1a73e8; color: #fff;
  border: none; border-radius: 6px; font-size: 13px; cursor: pointer;
}
.btn-bind:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-unbind {
  padding: 8px 14px; background: #fff; color: #d93025;
  border: 1px solid #f28b82; border-radius: 6px; font-size: 13px; cursor: pointer;
}
.btn-unbind:hover { background: #fce8e6; }

.loading-state {
  text-align: center;
  padding: 60px;
  color: #999;
}

/* ===== Novel Create Phase ===== */
.novel-create {
  max-width: 520px;
  margin: 0 auto;
}

.novel-create .form-group {
  margin-bottom: 24px;
}

.toggle-group .toggle-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toggle-btn {
  width: 52px;
  height: 28px;
  border-radius: 14px;
  border: none;
  background: #dadce0;
  cursor: pointer;
  position: relative;
  transition: background 0.25s;
  padding: 0;
}

.toggle-btn.active {
  background: #1a73e8;
}

.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.25s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-btn.active .toggle-knob {
  transform: translateX(24px);
}

.toggle-label {
  font-size: 15px;
  font-weight: 500;
  color: #202124;
  min-width: 48px;
}

.toggle-hint {
  font-size: 13px;
  color: #999;
}

.create-action {
  margin-top: 32px;
  text-align: center;
}

.btn-create-book {
  padding: 14px 48px;
  background: #1a73e8;
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s;
  box-shadow: 0 2px 12px rgba(26, 115, 232, 0.3);
}

.btn-create-book:hover:not(:disabled) {
  background: #1557b0;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(26, 115, 232, 0.4);
}

.btn-create-book:disabled {
  background: #a8c7fa;
  cursor: not-allowed;
  box-shadow: none;
}

/* ===== Novel Write Phase ===== */
.novel-write {
  /* no extra wrapper styling needed */
}

.section-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.section-tab {
  flex: 1;
  padding: 10px 16px;
  border: 2px solid #e8eaed;
  border-radius: 8px;
  background: #ffffff;
  font-size: 14px;
  font-weight: 500;
  color: #5f6368;
  cursor: pointer;
  transition: all 0.25s;
}

.section-tab:hover {
  border-color: #a8c7fa;
  color: #1a73e8;
}

.section-tab.active {
  border-color: #1a73e8;
  background: #e8f0fe;
  color: #1a73e8;
  font-weight: 600;
}

.selector-row {
  margin-bottom: 18px;
}

.selector-row .field-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #5f6368;
  margin-bottom: 6px;
}

.chapter-title-field {
  margin-bottom: 18px;
}

.chapter-title-field .field-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #5f6368;
  margin-bottom: 6px;
}

.novel-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
.novel-col-left .selector-row, .novel-col-left .chapter-title-field { margin-bottom: 14px; }
.novel-col-left .field-label { display: block; font-size: 13px; font-weight: 500; color: #5f6368; margin-bottom: 6px; }
.novel-col-left .form-select { width: 100%; padding: 8px 12px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; outline: none; }

.bound-world-card { background: #f8f9fa; border-radius: 12px; padding: 20px; border: 1px solid #e8eaed; }
.bound-world-card h4 { margin: 0 0 12px 0; font-size: 15px; color: #202124; }
.bound-world-name { font-size: 17px; font-weight: 600; color: #1a73e8; margin: 0 0 8px 0; }
.bound-world-link { color: #1a73e8; font-size: 13px; cursor: pointer; display: inline-block; margin-bottom: 10px; }
.bound-world-link:hover { text-decoration: underline; }
.bound-world-hint { font-size: 13px; color: #999; margin: 0 0 8px 0; }
.bound-world-card .btn-unbind { display: block; width: 100%; padding: 6px 0; background: #fff; color: #d93025; border: 1px solid #f28b82; border-radius: 6px; cursor: pointer; font-size: 13px; }
.bound-world-card .btn-unbind:hover { background: #fce8e6; }
.bound-world-card .btn-bind { padding: 8px 0; background: #1a73e8; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
.bound-world-card .btn-bind:disabled { opacity: 0.5; cursor: not-allowed; }
.bound-world-card .bind-select { padding: 8px 12px; border: 1px solid #dadce0; border-radius: 6px; font-size: 13px; outline: none; }

/* ── AI Panel ── */
.writing-area-row {
  display: flex;
  gap: 0;
  margin-bottom: 0;
}

.writing-area-row .writing-area {
  flex: 1;
  min-width: 0;
}

.writing-area-row .writing-textarea {
  border-radius: 0 0 0 8px;
  resize: vertical;
  min-height: 420px;
}

.ai-panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #e8eaed;
  border-left: 1px solid #e8eaed;
  border-radius: 0 0 8px 0;
  background: #fafbfc;
}

.ai-panel-header {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #1a73e8;
  border-bottom: 1px solid #e8eaed;
  background: #fff;
}

.ai-output {
  flex: 1;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.8;
  color: #202124;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 320px;
  max-height: 500px;
}

.ai-output.loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-loading-text {
  color: #1a73e8;
  font-size: 14px;
  animation: ai-pulse 1.5s ease-in-out infinite;
}

@keyframes ai-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.ai-placeholder {
  color: #bdc1c6;
  font-size: 13px;
}

.ai-continue-btn {
  margin: 0 12px 12px;
  padding: 10px 0;
  background: linear-gradient(135deg, #1a73e8 0%, #4285f4 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s;
  box-shadow: 0 2px 8px rgba(26, 115, 232, 0.2);
}

.ai-continue-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(26, 115, 232, 0.35);
}

.ai-continue-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

@media (max-width: 900px) {
  .writing-area-row {
    flex-direction: column;
  }
  .ai-panel {
    width: 100%;
    border-left: 1px solid #e8eaed;
    border-top: none;
    border-radius: 0 0 8px 8px;
  }
  .writing-area-row .writing-textarea {
    border-radius: 0 0 0 0;
  }
}

@media (max-width: 700px) { .novel-two-col { grid-template-columns: 1fr; } }
</style>
