<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import GlassCard from '@/components/GlassCard.vue'
import AppButton from '@/components/AppButton.vue'
import AppInput from '@/components/AppInput.vue'

const router = useRouter()
const email = ref('')
const code = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errMsg = ref('')
const codeSent = ref(false)
const success = ref(false)

const sendCode = async () => {
  errMsg.value = ''
  if (!email.value) {
    errMsg.value = '请输入邮箱'
    return
  }
  loading.value = true
  try {
    await http.post('/auth/forgot-password', { email: email.value })
    codeSent.value = true
  } catch (error: any) {
    errMsg.value = error.message || '发送失败'
  } finally {
    loading.value = false
  }
}

const handleReset = async () => {
  errMsg.value = ''
  if (!code.value) { errMsg.value = '请输入验证码'; return }
  if (newPassword.value.length < 8) { errMsg.value = '密码长度至少为8位'; return }
  if (newPassword.value !== confirmPassword.value) { errMsg.value = '两次输入的密码不一致'; return }

  loading.value = true
  try {
    await http.post('/auth/reset-password', {
      email: email.value,
      code: code.value,
      newPassword: newPassword.value
    })
    success.value = true
    setTimeout(() => router.push('/login'), 2000)
  } catch (error: any) {
    errMsg.value = error.message || '重置失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <GlassCard class="card">
      <div class="brand">
        <h1>找回密码</h1>
        <p v-if="!codeSent">输入注册邮箱，获取验证码</p>
        <p v-else>输入验证码和新密码</p>
      </div>

      <div v-if="success" class="success-msg">密码已重置，即将跳转登录...</div>
      <div v-else-if="errMsg" class="error-msg">{{ errMsg }}</div>

      <form v-if="!success" @submit.prevent="codeSent ? handleReset() : sendCode()" class="form">
        <AppInput v-model="email" type="email" placeholder="注册邮箱" :disabled="codeSent" />
        <template v-if="codeSent">
          <AppInput v-model="code" placeholder="6位验证码" maxlength="6" />
          <AppInput v-model="newPassword" type="password" placeholder="新密码（至少8位）" />
          <AppInput v-model="confirmPassword" type="password" placeholder="确认新密码" />
        </template>
        <AppButton type="submit" :loading="loading">{{ codeSent ? '重置密码' : '获取验证码' }}</AppButton>
        <button v-if="codeSent" type="button" class="link-btn" @click="codeSent = false">重新输入邮箱</button>
      </form>

      <div class="footer">
        <router-link to="/login">返回登录</router-link>
      </div>
    </GlassCard>
  </div>
</template>

<style scoped>
.page {
  position: fixed; inset: 0;
  background: linear-gradient(135deg, #e8f0fe 0%, #f8f9fa 40%, #eaf1fb 100%);
  display: flex; justify-content: center; align-items: center;
}
.card { width: 100%; max-width: 400px; padding: 48px 44px 36px; }
.brand { text-align: center; margin-bottom: 32px; }
.brand h1 { font-size: 28px; font-weight: 400; letter-spacing: 0.1em; }
.brand p { font-size: 13px; color: #666; margin-top: 8px; }
.form { display: flex; flex-direction: column; gap: 14px; }
.error-msg { background: rgba(252,232,230,0.7); color: #d93025; padding: 10px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
.success-msg { background: rgba(230,252,232,0.7); color: #1a7f3a; padding: 10px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
.link-btn { background: none; border: none; color: #5f6368; cursor: pointer; font-size: 13px; text-decoration: underline; }
.footer { text-align: center; margin-top: 24px; padding-top: 18px; border-top: 1px solid #e8eaed; }
.footer a { font-size: 13px; color: #5f6368; text-decoration: none; }
</style>
