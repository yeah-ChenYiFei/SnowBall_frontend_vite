<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'

const props = defineProps<{
  running: boolean
  done: boolean
  duration?: number
}>()

const TIPS = [
  '❄️ 雪球提示：好的设定是故事的骨架，多花时间打磨世界观会让 AI 创作更出彩。',
  '📝 写作小窍门：先列出关键人物和冲突，再让 AI 帮你填充细节。',
  '🌍 世界构建：每个地点都可以有一段历史，试试给地图上的每座城写一小段背景。',
  '👥 人物塑造：给角色一个秘密、一个恐惧和一个渴望，他们会变得鲜活起来。',
  '⛓️ 接龙技巧：读一遍前面的内容再续写，保持语气和节奏一致。',
  '🎭 冲突即故事：没有冲突就没有故事。你的人物想要什么？谁在阻止他们？',
  '💡 灵感备忘：随时随地记录闪过的念头，它们可能成为你最好的故事种子。',
  '🖊️ 自由写作：关掉内心的编辑，先写出来再修改。完美主义是创造力的敌人。',
  '📚 阅读即养分：多读不同类型的作品，你的写作工具箱会越来越丰富。',
  '🔮 试试看：选择一个冷门的设定条目，围绕它展开一段意想不到的情节。',
  '✨ AI 是助手不是替身：用 AI 突破瓶颈、寻找灵感，但故事的内核始终是你的。',
  '🎪 多线叙事：给每个重要角色一条独立的故事线，让它们在关键时刻交汇。',
  '🌊 节奏感：长句舒缓、短句紧张，用句子长度控制读者的呼吸。',
  '🗺️ 世界观并非越细越好：留一些空白，让读者用自己的想象去填补。',
  '⚡ 开篇即钩子：第一句话就要让读者想问"然后呢？"',
]

const DURATION = computed(() => (props.duration ?? 13) * 1000)
const progress = ref(0)
const barPct = ref('0%')
const barClass = ref('')
const doneVisible = ref(false)

// Rotating tips
const tipIndex = ref(Math.floor(Math.random() * TIPS.length))
let tipTimer: ReturnType<typeof setInterval> | null = null

// Progress animation
let timer: ReturnType<typeof setInterval> | null = null
let startTime = 0
let finishTimeout: ReturnType<typeof setTimeout> | null = null

function clearAll() {
  if (timer) { clearInterval(timer); timer = null }
  if (finishTimeout) { clearTimeout(finishTimeout); finishTimeout = null }
  if (tipTimer) { clearInterval(tipTimer); tipTimer = null }
}

function start() {
  clearAll()
  startTime = Date.now()
  progress.value = 0
  barPct.value = '0%'
  barClass.value = ''
  doneVisible.value = false

  // Random start tip
  tipIndex.value = Math.floor(Math.random() * TIPS.length)

  // Rotate tips every 4 seconds
  tipTimer = setInterval(() => {
    tipIndex.value = (tipIndex.value + 1) % TIPS.length
  }, 4000)

  timer = setInterval(() => {
    const elapsed = Date.now() - startTime
    const dur = DURATION.value
    const pct = Math.min(95, (elapsed / dur) * 100)

    progress.value = pct
    barPct.value = pct + '%'

    if (elapsed >= dur) {
      clearAll()
      // Still rotate tips while waiting at 95%
      tipTimer = setInterval(() => {
        tipIndex.value = (tipIndex.value + 1) % TIPS.length
      }, 4000)
    }
  }, 60)
}

function finish() {
  clearAll()
  barClass.value = 'finishing'
  void (document.body.offsetHeight)
  progress.value = 100
  barPct.value = '100%'
  finishTimeout = setTimeout(() => {
    doneVisible.value = true
  }, 220)
}

watch(() => props.running, (v) => {
  if (v) start()
})

watch(() => props.done, (v) => {
  if (v && progress.value > 0) finish()
})

onBeforeUnmount(clearAll)

const currentTip = computed(() => TIPS[tipIndex.value])
</script>

<template>
  <div v-if="progress > 0 && !doneVisible" class="apb-wrap">
    <!-- Rotating tip -->
    <transition name="tip-fade" mode="out-in">
      <p :key="tipIndex" class="apb-tip">{{ currentTip }}</p>
    </transition>

    <!-- Progress bar -->
    <div class="apb-track">
      <div :class="['apb-bar', barClass]" :style="{ width: barPct }">
        <div class="apb-shimmer" />
      </div>
    </div>

    <!-- Info row -->
    <div class="apb-info">
      <span class="apb-pct">{{ Math.round(progress) }}%</span>
      <span v-if="!props.done" class="apb-wait">等待 AI 响应...</span>
      <span v-else class="apb-done">✓ 生成完成</span>
    </div>
  </div>
</template>

<style scoped>
.apb-wrap {
  width: 100%;
  margin: 10px 0 8px;
}

/* ---- Tip ---- */
.apb-tip {
  margin: 0 0 10px 0;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(102,126,234,0.06), rgba(26,115,232,0.06));
  border: 1px solid rgba(26,115,232,0.1);
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.6;
  color: #5f6368;
}

.tip-fade-enter-active,
.tip-fade-leave-active {
  transition: opacity 0.35s ease;
}
.tip-fade-enter-from,
.tip-fade-leave-to {
  opacity: 0;
}

/* ---- Track ---- */
.apb-track {
  position: relative;
  height: 8px;
  border-radius: 4px;
  background: #e8eaed;
  overflow: hidden;
  width: 100%;
}

/* ---- Bar ---- */
.apb-bar {
  position: relative;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #667eea, #1a73e8, #42a5f5);
  transition: width 0.06s linear;
  overflow: hidden;
}
.apb-bar.finishing {
  transition: width 0.2s ease-out;
}

/* ---- Shimmer overlay ---- */
.apb-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.35) 50%,
    transparent 100%
  );
  animation: shimmer-sweep 1.8s ease-in-out infinite;
}
@keyframes shimmer-sweep {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

/* ---- Info row ---- */
.apb-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}
.apb-pct {
  font-size: 13px;
  font-weight: 600;
  color: #1a73e8;
  font-variant-numeric: tabular-nums;
}
.apb-wait {
  font-size: 12px;
  color: #999;
}
.apb-done {
  font-size: 12px;
  color: #43a047;
  font-weight: 500;
}
</style>
