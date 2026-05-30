<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Slide {
  image: string
  tagline: string
}

const slides: Slide[] = [
  { image: '/center.png', tagline: '针对不同写作场景选择对应的创作题材' },
  { image: '/set.png', tagline: '在设定中心丰富完善自己的世界观oc' },
  { image: '/novel.png', tagline: '舒适详尽的小说工作台' },
  { image: '/dragon.png', tagline: '友人与否，都能来上一场文学接龙' },
  { image: '/public.png', tagline: '将自己的设定或小说展示给全世界' },
  { image: '/group.png', tagline: '在群组中与与二三好友插科打诨' },
]

const currentIndex = ref(0)
const taglineKey = ref(0)
let autoTimer: ReturnType<typeof setInterval> | null = null

const MAX_VISIBLE = 4

interface CardState {
  slide: Slide
  pos: number
  visible: boolean
}

const cardStates = computed<CardState[]>(() => {
  return slides.map((slide, i) => {
    let dist = (i - currentIndex.value + slides.length) % slides.length
    if (dist > slides.length / 2) dist = dist - slides.length
    const visible = dist >= 0 && dist < MAX_VISIBLE
    return { slide, pos: dist, visible }
  })
})

const X_OFFSETS  = [0, 50, 82, 104]
const OPACITIES   = [1, 0.55, 0.28, 0.10]
const SCALES      = [1, 0.965, 0.94, 0.92]

function cardStyle(pos: number) {
  const i = Math.min(pos, X_OFFSETS.length - 1)
  return {
    transform: `translate(calc(-50% + ${X_OFFSETS[i]}px), -50%) scale(${SCALES[i]})`,
    opacity: OPACITIES[i],
    zIndex: MAX_VISIBLE - i,
    pointerEvents: pos === 0 ? 'auto' : 'none',
  }
}

// ── Auto-play only ──
const isAnimating = ref(false)

function goNext() {
  if (isAnimating.value) return
  isAnimating.value = true
  taglineKey.value++
  currentIndex.value = (currentIndex.value + 1) % slides.length
  setTimeout(() => { isAnimating.value = false }, 580)
  resetTimer()
}

function resetTimer() {
  if (autoTimer) clearInterval(autoTimer)
  autoTimer = setInterval(goNext, 2500)
}

const activeTagline = computed(() => slides[currentIndex.value].tagline)

onMounted(() => {
  autoTimer = setInterval(goNext, 2500)
})

onUnmounted(() => {
  if (autoTimer) clearInterval(autoTimer)
})
</script>

<template>
  <div class="carousel-container">
    <!-- ── Stack + Tagline wrapper for independent positioning ── -->
    <div class="stack-and-tagline">
      <!-- ── Card stack ── -->
      <div class="stack-area">
        <template v-for="(card, i) in cardStates" :key="i">
          <div
            v-if="card.visible"
            class="card-frame"
            :style="cardStyle(card.pos)"
          >
            <div class="card-image-wrapper">
              <img
                :src="card.slide.image"
                :alt="card.slide.tagline"
                class="card-image"
                draggable="false"
              />
            </div>
          </div>
        </template>
      </div>

      <!-- ── Tagline — independently positioned below images ── -->
      <Transition name="tagline-slide" mode="out-in">
        <p class="tagline-text" :key="taglineKey">{{ activeTagline }}</p>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.carousel-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
  width: 100%;
  max-width: 560px;
  padding-top: 100px;
}

/* ── Wrapper for stack + tagline ── */
.stack-and-tagline {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Stack area ── */
.stack-area {
  position: relative;
  width: 100%;
  height: 330px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Each card starts centred, then the inline style offsets it */
.card-frame {
  position: absolute;
  width: 440px;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(12px) saturate(120%);
  -webkit-backdrop-filter: blur(12px) saturate(120%);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow:
    0 8px 32px rgba(66, 133, 244, 0.07),
    0 2px 8px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  transition:
    transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.55s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
}

.card-image-wrapper {
  width: 100%;
  aspect-ratio: 16 / 11;
  overflow: hidden;
  background: #f5f6f8;
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* ── Tagline — independently positioned ── */
.tagline-text {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 300;
  color: var(--color-text);
  letter-spacing: 0.06em;
  white-space: nowrap;
  text-align: center;
  margin-top: -100px;
  margin-left: -100px;
}

/* Tagline: enter from right (spring bounce), leave to left */
.tagline-slide-enter-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tagline-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.55, 0, 1, 0.45);
}
.tagline-slide-enter-from {
  opacity: 0;
  transform: translateX(60px);
}
.tagline-slide-leave-to {
  opacity: 0;
  transform: translateX(-60px);
}

/* ── Responsive ── */
@media (max-width: 960px) {
  .carousel-container { max-width: 440px; }
  .card-frame  { width: 340px; }
  .stack-area  { height: 260px; }
  .tagline-text { font-size: 14px; }
}

@media (max-width: 640px) {
  .carousel-container { max-width: 360px; }
  .card-frame  { width: 280px; }
  .stack-area  { height: 220px; }
}
</style>
