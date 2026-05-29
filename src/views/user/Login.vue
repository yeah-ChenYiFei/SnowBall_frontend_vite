<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user.ts'
import SnowBg from '@/components/SnowBg.vue'
import GlassCard from '@/components/GlassCard.vue'
import AppButton from '@/components/AppButton.vue'
import AppInput from '@/components/AppInput.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const username = ref('')
const password = ref('')
const loading = ref(false)

const showLine = ref(false)
const showGroup = ref(false)
const currentGroup = ref(0)

const textGroups = [
  { cn: '灵感如雪花般消融', en: 'Inspiration melts like snowflakes' },
  { cn: '在梦中堆起儿时的雪堡', en: 'Building childhood snow forts in dreams' },
  { cn: '茫茫雪原中寻觅友人', en: 'Searching for friends across snowy plains' },
  { cn: '故事如雪球般滚动', en: 'Stories roll on like a snowball' },
]

onMounted(() => {
  setTimeout(() => { showLine.value = true }, 500)
  setTimeout(() => { showGroup.value = true }, 900)
  setTimeout(() => {
    setInterval(() => {
      currentGroup.value = (currentGroup.value + 1) % textGroups.length
    }, 4000)
  }, 4900)
})

const handleLogin = async () => {
  if (!username.value || !password.value) {
    alert('请输入账号密码')
    return
  }
  loading.value = true
  try {
    await userStore.login(username.value, password.value)
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (error: any) {
    alert(error.message || '登录失败，请重试')
  } finally {
    loading.value = false
  }
}

// ── Scroll behavior ──
const scrollContainer = ref<HTMLElement | null>(null)
const loginSection = ref<HTMLElement | null>(null)
const hasReachedLogin = ref(false)
const isTransitioning = ref(false)
const indicatorOpacity = ref(1)
const loginVisible = ref(false)

const SNAP_THRESHOLD = 0.12 // 12% of hero height triggers snap

function getLoginTop(): number {
  const el = scrollContainer.value
  const loginEl = loginSection.value
  if (!el || !loginEl) return el?.clientHeight || 0
  return loginEl.offsetTop
}

function onScroll() {
  if (isTransitioning.value) return

  const el = scrollContainer.value
  if (!el) return
  const heroH = el.clientHeight
  const scrollTop = el.scrollTop

  // Fade indicator as user scrolls
  indicatorOpacity.value = Math.max(0, 1 - scrollTop / (heroH * 0.3))

  // Already locked to login — clamp if user tries to scroll up
  if (hasReachedLogin.value) {
    const loginTop = getLoginTop()
    if (scrollTop < loginTop - 2) {
      el.scrollTop = loginTop
    }
    return
  }

  // Trigger snap transition
  if (scrollTop > heroH * SNAP_THRESHOLD) {
    isTransitioning.value = true
    const loginTop = getLoginTop()
    el.scrollTo({ top: loginTop, behavior: 'smooth' })

    setTimeout(() => {
      hasReachedLogin.value = true
      isTransitioning.value = false
      loginVisible.value = true
    }, 700)
  }
}

function onWheel(e: WheelEvent) {
  if (!hasReachedLogin.value) return
  const el = scrollContainer.value
  if (!el) return
  const loginTop = getLoginTop()

  // Block scroll-up when at login section
  if (e.deltaY < 0 && el.scrollTop <= loginTop + 5) {
    e.preventDefault()
  }
}

// Touch handling for mobile
let touchStartY = 0
function onTouchStart(e: TouchEvent) {
  touchStartY = e.touches[0].clientY
}
function onTouchMove(e: TouchEvent) {
  if (!hasReachedLogin.value) return
  const el = scrollContainer.value
  if (!el) return
  const loginTop = getLoginTop()
  const delta = touchStartY - e.touches[0].clientY // positive = scrolling up (finger down)

  if (delta > 0 && el.scrollTop <= loginTop + 5) {
    e.preventDefault()
  }
}

onMounted(() => {
  const el = scrollContainer.value
  if (!el) return

  // Wheel lock — must be non-passive to allow preventDefault
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchmove', onTouchMove, { passive: false })

  onUnmounted(() => {
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
  })
})
</script>

<template>
  <div class="login-page">
    <!-- Fixed background layer -->
    <div class="bg-layer">
      <SnowBg />
    </div>

    <!-- Fixed top-left artistic text — visible on both hero & login -->
    <div class="artistic-text">
      <div class="art-line" :class="{ visible: showLine }" />
      <Transition name="text-rotate" mode="out-in">
        <div v-if="showGroup" :key="currentGroup" class="art-text-group">
          <div class="art-chinese">{{ textGroups[currentGroup].cn }}</div>
          <div class="art-english">{{ textGroups[currentGroup].en }}</div>
        </div>
      </Transition>
    </div>

    <!-- Scrollable content -->
    <div
      ref="scrollContainer"
      class="scroll-container"
      @scroll="onScroll"
    >
      <!-- Hero / landing section -->
      <section class="hero-section">
        <!-- Scroll-down indicator: two parallel downward chevrons -->
        <div class="scroll-indicator" :style="{ opacity: indicatorOpacity }">
          <div class="chevron"></div>
          <div class="chevron"></div>
          <span class="scroll-hint">向下滚动登录</span>
        </div>
      </section>

      <!-- Login section -->
      <section ref="loginSection" class="login-section">
        <GlassCard class="login-card" :class="{ visible: loginVisible }">
          <div class="card-brand">
            <h1 class="brand-title">雪球</h1>
            <p class="brand-subtitle">你的OC写作平台</p>
          </div>

          <form @submit.prevent="handleLogin" class="login-form">
            <AppInput
              id="login-username"
              v-model="username"
              autocomplete="username"
              placeholder="用户名"
              required
            />
            <AppInput
              id="login-password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="密码"
              required
            />
            <AppButton
              type="submit"
              :loading="loading"
              :disabled="loading"
              class="submit-btn"
              @click="handleLogin"
            >
              <template v-if="!loading">登 录</template>
              <template v-else>登录中...</template>
            </AppButton>
          </form>

          <div class="card-footer">
            <router-link to="/forgot-password" class="forgot-link">忘记密码？</router-link>
            <router-link to="/register">还没有账号？<span>立即注册</span></router-link>
          </div>
        </GlassCard>
      </section>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #e8f0fe 0%, #f8f9fa 40%, #eaf1fb 100%);
  font-family: var(--font-serif);
  overflow: hidden;
}

/* ── Fixed background layer ── */
.bg-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* ── Fixed artistic text (always visible) ── */
.artistic-text {
  position: fixed;
  top: 40px;
  left: 48px;
  z-index: 30;
  pointer-events: none;
}

.art-line {
  width: 0;
  height: 1px;
  background: linear-gradient(90deg, #5f6368 0%, #9aa0a6 70%, transparent 100%);
  margin-bottom: 16px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.art-line.visible {
  width: 320px;
}

.art-chinese {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 300;
  color: var(--color-text);
  letter-spacing: 0.08em;
}

.art-english {
  font-family: 'Cormorant Garamond', serif;
  font-size: 15px;
  font-weight: 300;
  font-style: italic;
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
  margin-top: 4px;
}

/* Text rotate transitions */
.text-rotate-leave-active {
  transition: all 0.5s ease-in;
}
.text-rotate-leave-to {
  opacity: 0;
  transform: translateX(36px);
  filter: blur(8px);
}
.text-rotate-enter-active {
  transition: all 0.55s cubic-bezier(0.25, 0.1, 0.25, 1);
}
.text-rotate-enter-active .art-chinese {
  transition: opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s,
              transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s;
}
.text-rotate-enter-active .art-english {
  transition: opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s,
              transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s;
}
.text-rotate-enter-from {
  opacity: 0;
  transform: translateX(-48px);
}
.text-rotate-enter-from .art-chinese,
.text-rotate-enter-from .art-english {
  opacity: 0;
  transform: translateX(-48px) scale(0.9);
}

/* ── Scroll container ── */
.scroll-container {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
}

.scroll-container::-webkit-scrollbar {
  width: 0;
}

/* ── Hero section ── */
.hero-section {
  position: relative;
  height: 100vh;
  scroll-snap-align: start;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

/* ── Scroll-down indicator ── */
.scroll-indicator {
  position: absolute;
  bottom: 12%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 10;
  transition: opacity 0.35s ease;
}

.chevron {
  width: 26px;
  height: 18px;
  background: rgba(120, 130, 150, 0.4);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(140, 150, 170, 0.45);
  clip-path: polygon(50% 100%, 0% 0%, 100% 0%);
}

.chevron:nth-child(2) {
  animation: chevron-pulse 2s ease-in-out infinite;
}
.chevron:nth-child(1) {
  animation: chevron-pulse 2s ease-in-out 0.3s infinite;
}

@keyframes chevron-pulse {
  0%, 100% {
    opacity: 0.5;
    transform: translateY(0);
  }
  50% {
    opacity: 0.85;
    transform: translateY(6px);
  }
}

.scroll-hint {
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 200;
  color: var(--color-text-secondary);
  letter-spacing: 0.15em;
  white-space: nowrap;
}

/* ── Login section ── */
.login-section {
  min-height: 100vh;
  scroll-snap-align: start;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 20px;
}

/* ── Login card ── */
.login-card {
  position: relative;
  z-index: 20;
  width: 100%;
  max-width: 400px;
  padding: 48px 44px 36px;

  opacity: 0;
  transform: translateY(80px);
  transition:
    opacity 0.7s cubic-bezier(0.25, 0.1, 0.25, 1) 0.1s,
    transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s;
}

.login-card.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Brand ── */
.card-brand {
  text-align: center;
  margin-bottom: 36px;
}

.brand-title {
  font-family: var(--font-serif);
  font-size: 32px;
  font-weight: 400;
  color: var(--color-text);
  margin: 0;
  letter-spacing: 0.12em;
}

.brand-subtitle {
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 200;
  color: var(--color-text-secondary);
  margin: 10px 0 0;
  letter-spacing: 0.06em;
}

/* ── Form ── */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.submit-btn {
  width: 100%;
  margin-top: 8px;
  letter-spacing: 0.2em;
}

/* ── Footer ── */
.card-footer {
  text-align: center;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border-subtle);
}

.card-footer a {
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 200;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.card-footer a span {
  color: var(--color-primary);
  font-weight: 300;
}

.card-footer a:hover {
  color: var(--color-primary);
}

.forgot-link {
  display: block;
  margin-bottom: 8px;
}

/* ── Responsive ── */
@media (max-width: 480px) {
  .artistic-text {
    top: 24px;
    left: 24px;
  }

  .art-line.visible {
    width: 200px;
  }

  .art-chinese {
    font-size: 18px;
  }

  .art-english {
    font-size: 13px;
  }

  .login-card {
    padding: 36px 28px 28px;
    max-width: 340px;
  }

  .scroll-indicator {
    bottom: 15%;
  }
}
</style>
