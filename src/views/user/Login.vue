<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
</script>

<template>
  <div class="login-fullscreen">
    <SnowBg />

    <!-- Top-left artistic text -->
    <div class="artistic-text">
      <div class="art-line" :class="{ visible: showLine }" />
      <Transition name="text-rotate" mode="out-in">
        <div v-if="showGroup" :key="currentGroup" class="art-text-group">
          <div class="art-chinese">{{ textGroups[currentGroup].cn }}</div>
          <div class="art-english">{{ textGroups[currentGroup].en }}</div>
        </div>
      </Transition>
    </div>

    <!-- Glass card -->
    <GlassCard class="login-card">
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
        <router-link to="/register">还没有账号？<span>立即注册</span></router-link>
      </div>
    </GlassCard>
  </div>
</template>

<style scoped>
.login-fullscreen {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #e8f0fe 0%, #f8f9fa 40%, #eaf1fb 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  font-family: var(--font-serif);
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

/* Transition: leave (slide right + blur) */
.text-rotate-leave-active {
  transition: all 0.5s ease-in;
}

.text-rotate-leave-to {
  opacity: 0;
  transform: translateX(36px);
  filter: blur(8px);
}

/* Transition: enter (pop in from left) */
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

/* ── Login card ── */
.login-card {
  position: relative;
  z-index: 20;
  width: 100%;
  max-width: 400px;
  padding: 48px 44px 36px;
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
</style>
