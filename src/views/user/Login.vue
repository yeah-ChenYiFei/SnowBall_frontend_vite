<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user.ts'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const username = ref('')
const password = ref('')
const loading = ref(false)

const showLine = ref(false)
const showChinese = ref(false)
const showEnglish = ref(false)

onMounted(() => {
  setTimeout(() => { showLine.value = true }, 500)
  setTimeout(() => { showChinese.value = true }, 900)
  setTimeout(() => { showEnglish.value = true }, 1300)
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

const blobs = [
  { size: 180, left: 8,  delay: 0,   dur: 22, color: 'rgba(200,220,245,0.65)' },
  { size: 120, left: 22, delay: -5,  dur: 28, color: 'rgba(235,240,250,0.55)' },
  { size: 260, left: 38, delay: -8,  dur: 32, color: 'rgba(180,210,240,0.5)' },
  { size: 90,  left: 55, delay: -3,  dur: 20, color: 'rgba(220,230,248,0.6)' },
  { size: 200, left: 70, delay: -12, dur: 26, color: 'rgba(190,215,242,0.55)' },
  { size: 140, left: 85, delay: -6,  dur: 24, color: 'rgba(240,243,252,0.5)' },
  { size: 100, left: 15, delay: -14, dur: 18, color: 'rgba(210,225,246,0.6)' },
  { size: 230, left: 48, delay: -9,  dur: 30, color: 'rgba(175,205,238,0.45)' },
  { size: 160, left: 75, delay: -2,  dur: 21, color: 'rgba(225,235,250,0.55)' },
  { size: 110, left: 32, delay: -10, dur: 19, color: 'rgba(200,222,247,0.6)' },
  { size: 280, left: 62, delay: -16, dur: 34, color: 'rgba(185,212,242,0.4)' },
  { size: 70,  left: 92, delay: -4,  dur: 16, color: 'rgba(245,248,253,0.55)' },
  { size: 150, left: 42, delay: -7,  dur: 25, color: 'rgba(195,218,244,0.5)' },
  { size: 190, left: 80, delay: -15, dur: 27, color: 'rgba(230,238,251,0.5)' },
]
</script>

<template>
  <div class="login-fullscreen">
    <!-- SVG filters for crayon texture -->
    <svg class="texture-svg">
      <defs>
        <filter id="crayon-filter" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feComposite in="displaced" in2="SourceGraphic" operator="over" />
        </filter>
        <filter id="crayon-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
          <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="textured" />
        </filter>
      </defs>
    </svg>

    <!-- Falling blobs -->
    <div class="blobs-layer">
      <div
        v-for="(b, i) in blobs"
        :key="i"
        class="blob"
        :style="{
          width: b.size + 'px',
          height: b.size + 'px',
          left: b.left + '%',
          animationDelay: b.delay + 's',
          animationDuration: b.dur + 's',
          background: `radial-gradient(circle at 35% 35%, ${b.color} 0%, ${b.color} 30%, ${b.color.replace(/[\d.]+\)$/, '0.25)')} 55%, transparent 75%)`,
        }"
      />
    </div>

    <!-- Top-left artistic text -->
    <div class="artistic-text">
      <div class="art-line" :class="{ visible: showLine }" />
      <div class="art-chinese" :class="{ visible: showChinese }">故事如雪球般滚动</div>
      <div class="art-english" :class="{ visible: showEnglish }">Stories roll on like a snowball</div>
    </div>

    <!-- Glass card -->
    <div class="glass-card">
      <div class="card-brand">
        <h1 class="brand-title">雪球</h1>
        <p class="brand-subtitle">你的OC写作平台</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="input-group">
          <input
            id="login-username"
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="用户名"
            required
          />
        </div>
        <div class="input-group">
          <input
            id="login-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="密码"
            required
          />
        </div>
        <button type="submit" class="login-btn" :disabled="loading">
          <span v-if="!loading">登 录</span>
          <span v-else class="btn-loading">登录中...</span>
        </button>
      </form>

      <div class="card-footer">
        <router-link to="/register">还没有账号？<span>立即注册</span></router-link>
      </div>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200;300;400;600&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&display=swap');
</style>

<style scoped>
.login-fullscreen {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #e8f0fe 0%, #f8f9fa 40%, #eaf1fb 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  font-family: 'Noto Serif SC', 'Cormorant Garamond', serif;
}

.texture-svg {
  position: absolute;
  width: 0;
  height: 0;
}

/* ── Blobs layer ── */
.blobs-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.blob {
  position: absolute;
  top: -300px;
  border-radius: 42% 56% 48% 52% / 44% 38% 54% 46%;
  filter: url(#crayon-filter) blur(2px);
  opacity: 0.8;
  animation: blob-fall linear infinite;
}

.blob:nth-child(odd) {
  border-radius: 48% 40% 55% 45% / 50% 46% 42% 52%;
}

.blob:nth-child(3n) {
  border-radius: 52% 48% 40% 56% / 40% 54% 48% 44%;
}

.blob:nth-child(3n+1) {
  border-radius: 45% 52% 44% 50% / 52% 40% 50% 43%;
}

.blob:nth-child(4n) {
  border-radius: 50% 44% 52% 46% / 42% 50% 43% 54%;
}

@keyframes blob-fall {
  0% {
    transform: translateY(-300px) translateX(0) scale(1);
  }
  25% {
    transform: translateY(25vh) translateX(-15px) scale(1.02);
  }
  50% {
    transform: translateY(55vh) translateX(10px) scale(0.97);
  }
  75% {
    transform: translateY(80vh) translateX(-8px) scale(1.01);
  }
  100% {
    transform: translateY(110vh) translateX(5px) scale(0.96);
  }
}

/* ── Artistic text ── */
.artistic-text {
  position: absolute;
  top: 40px;
  left: 48px;
  z-index: 10;
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
  font-family: 'Noto Serif SC', serif;
  font-size: 22px;
  font-weight: 300;
  color: #3c4043;
  letter-spacing: 0.08em;
  opacity: 0;
  transform: translateX(-20px);
  transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
}

.art-chinese.visible {
  opacity: 1;
  transform: translateX(0);
}

.art-english {
  font-family: 'Cormorant Garamond', serif;
  font-size: 15px;
  font-weight: 300;
  font-style: italic;
  color: #80868b;
  letter-spacing: 0.04em;
  margin-top: 4px;
  opacity: 0;
  transform: translateX(-16px);
  transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.art-english.visible {
  opacity: 1;
  transform: translateX(0);
}

/* ── Glass card ── */
.glass-card {
  position: relative;
  z-index: 20;
  width: 100%;
  max-width: 400px;
  padding: 48px 44px 36px;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(24px) saturate(120%);
  -webkit-backdrop-filter: blur(24px) saturate(120%);
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 20px;
  box-shadow:
    0 8px 32px rgba(66, 133, 244, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  transition: box-shadow 0.3s ease;
}

.glass-card:hover {
  box-shadow:
    0 12px 40px rgba(66, 133, 244, 0.12),
    0 4px 12px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

/* ── Brand ── */
.card-brand {
  text-align: center;
  margin-bottom: 36px;
}

.brand-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 32px;
  font-weight: 400;
  color: #202124;
  margin: 0;
  letter-spacing: 0.12em;
}

.brand-subtitle {
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  font-weight: 200;
  color: #5f6368;
  margin: 10px 0 0;
  letter-spacing: 0.06em;
}

/* ── Form ── */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-group input {
  width: 100%;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(200, 210, 220, 0.5);
  border-radius: 12px;
  font-family: 'Noto Serif SC', serif;
  font-size: 15px;
  font-weight: 300;
  color: #202124;
  outline: none;
  box-sizing: border-box;
  transition: all 0.25s ease;
}

.input-group input::placeholder {
  color: #9aa0a6;
  font-weight: 200;
}

.input-group input:focus {
  border-color: rgba(26, 115, 232, 0.5);
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.08);
}

.login-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #1a73e8 0%, #4285f4 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-family: 'Noto Serif SC', serif;
  font-size: 16px;
  font-weight: 400;
  letter-spacing: 0.2em;
  cursor: pointer;
  transition: all 0.25s ease;
  margin-top: 8px;
}

.login-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #1557b0 0%, #3474d9 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(26, 115, 232, 0.3);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-loading {
  letter-spacing: 0.08em;
}

/* ── Footer ── */
.card-footer {
  text-align: center;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid rgba(200, 210, 220, 0.25);
}

.card-footer a {
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  font-weight: 200;
  color: #5f6368;
  text-decoration: none;
  transition: color 0.2s;
}

.card-footer a span {
  color: #1a73e8;
  font-weight: 300;
}

.card-footer a:hover {
  color: #1a73e8;
}
</style>
