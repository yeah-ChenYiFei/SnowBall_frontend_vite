<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'

const router = useRouter()
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errMsg = ref('')

const handleRegister = async () => {
  errMsg.value = ''

  if (!username.value || !password.value) {
    errMsg.value = '用户名和密码不能为空'
    return
  }
  if (username.value.length < 3) {
    errMsg.value = '用户名长度至少为3位'
    return
  }
  if (password.value.length < 6) {
    errMsg.value = '密码长度至少为6位'
    return
  }
  if (password.value !== confirmPassword.value) {
    errMsg.value = '两次输入的密码不一致'
    return
  }

  loading.value = true
  try {
    await http.post('/auth/register', {
      username: username.value,
      password: password.value
    })
    alert('🎉 注册成功！请登录')
    router.push('/login')
  } catch (error: any) {
    errMsg.value = error.message || '注册失败，请稍后再试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <span class="login-icon">⛄</span>
        <h1 class="login-title">加入雪球</h1>
        <p class="login-subtitle">开启你的故事共创之旅</p>
      </div>

      <div v-if="errMsg" class="error-alert">{{ errMsg }}</div>

      <form @submit.prevent="handleRegister" class="login-form">
        <div class="form-group">
          <!-- ✅ 补全 for 属性 -->
          <label for="reg-username">用户名</label>
          <!-- ✅ 注册场景：使用 username -->
          <input id="reg-username" v-model="username" type="text" autocomplete="username" placeholder="至少3个字符" />
        </div>
        <div class="form-group">
          <label for="reg-password">密码</label>
          <!-- ✅ 注册场景：使用 new-password -->
          <input id="reg-password" v-model="password" type="password" autocomplete="new-password" placeholder="至少6个字符" />
        </div>
        <div class="form-group">
          <label for="reg-confirm">确认密码</label>
          <!-- ✅ 注册场景：再次输入新密码也用 new-password -->
          <input id="reg-confirm" v-model="confirmPassword" type="password" autocomplete="new-password" placeholder="请再次输入密码" />
        </div>
        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? '注册中...' : '立即注册' }}
        </button>
      </form>

      <div class="login-footer">
        <router-link to="/login" class="register-link">已有账号？返回登录</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container { display: flex; justify-content: center; align-items: center; min-height: calc(100vh - 64px); background: linear-gradient(135deg, #e8f0fe 0%, #f8f9fa 100%); }
.login-card { background: white; border-radius: 12px; padding: 48px 40px; width: 100%; max-width: 420px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); }
.login-header { text-align: center; margin-bottom: 32px; }
.login-icon { font-size: 48px; display: block; margin-bottom: 16px; }
.login-title { font-size: 24px; font-weight: 600; color: #202124; margin: 0 0 8px 0; }
.login-subtitle { font-size: 14px; color: #5f6368; margin: 0; }
.login-form { display: flex; flex-direction: column; gap: 20px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 14px; font-weight: 500; color: #202124; }
.form-group input { padding: 12px 16px; border: 1px solid #dadce0; border-radius: 8px; font-size: 15px; outline: none; transition: all 0.2s ease; }
.form-group input:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.1); }
.login-btn { padding: 12px; background: #1a73e8; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; margin-top: 8px; }
.login-btn:hover:not(:disabled) { background: #1557b0; }
.login-btn:disabled { background: #a8c7fa; cursor: not-allowed; }
.login-footer { text-align: center; margin-top: 24px; padding-top: 24px; border-top: 1px solid #e8eaed; }
.register-link { color: #1a73e8; text-decoration: none; font-size: 14px; }
.register-link:hover { text-decoration: underline; }
.error-alert { background: #fce8e6; color: #d93025; padding: 12px; border-radius: 6px; font-size: 14px; margin-bottom: 20px; border: 1px solid #f28b82; }
</style>
