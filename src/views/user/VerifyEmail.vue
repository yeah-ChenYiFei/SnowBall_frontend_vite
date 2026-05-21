<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '@/api/http'
import SnowBg from '@/components/SnowBg.vue'
import GlassCard from '@/components/GlassCard.vue'
import AppButton from '@/components/AppButton.vue'
import AppInput from '@/components/AppInput.vue'

const route = useRoute()
const router = useRouter()
const code = ref('')
const loading = ref(false)
const errMsg = ref('')
const success = ref(false)

const userId = Number(route.query.userId)

const handleVerify = async () => {
  errMsg.value = ''
  if (!code.value) {
    errMsg.value = '请输入验证码'
    return
  }

  loading.value = true
  try {
    await http.post(`/auth/verify-email?userId=${userId}`, { code: code.value })
    success.value = true
    setTimeout(() => router.push('/login'), 2000)
  } catch (error: any) {
    errMsg.value = error.message || '验证失败，请稍后再试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-fullscreen">
    <SnowBg />

    <GlassCard class="register-card">
      <div class="card-brand">
        <h1 class="brand-title">验证邮箱</h1>
        <p class="brand-subtitle">验证码已发送至您的邮箱，10分钟内有效</p>
      </div>

      <div v-if="success" class="success-alert">
        验证成功！即将跳转到登录页...
      </div>
      <div v-else-if="errMsg" class="error-alert">{{ errMsg }}</div>

      <form v-if="!success" @submit.prevent="handleVerify" class="login-form">
        <AppInput
          id="verify-code"
          v-model="code"
          placeholder="请输入6位验证码"
          maxlength="6"
          required
        />
        <AppButton
          type="submit"
          :loading="loading"
          :disabled="loading"
          class="submit-btn"
        >
          <template v-if="!loading">验 证</template>
          <template v-else>验证中...</template>
        </AppButton>
      </form>

      <div class="card-footer">
        <router-link to="/login">返回登录</router-link>
      </div>
    </GlassCard>
  </div>
</template>

<style scoped>
.register-fullscreen {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #e8f0fe 0%, #f8f9fa 40%, #eaf1fb 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  font-family: var(--font-serif);
}

.register-card {
  position: relative;
  z-index: 20;
  width: 100%;
  max-width: 400px;
  padding: 48px 44px 36px;
}

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

.error-alert {
  background: rgba(252, 232, 230, 0.7);
  backdrop-filter: blur(8px);
  color: var(--color-danger);
  padding: 12px 14px;
  border-radius: var(--radius-md);
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 300;
  margin-bottom: 20px;
  border: 1px solid rgba(242, 139, 130, 0.3);
}

.success-alert {
  background: rgba(230, 252, 232, 0.7);
  backdrop-filter: blur(8px);
  color: #1a7f3a;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 300;
  margin-bottom: 20px;
  border: 1px solid rgba(52, 168, 83, 0.3);
}

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
</style>
