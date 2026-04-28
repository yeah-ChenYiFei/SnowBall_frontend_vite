<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user.ts'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const username = ref('')
const password = ref('')
const loading = ref(false)

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
  <div class="login-container">
    <div class="login-card">
      <!-- 雪球品牌 -->
      <div class="login-header">
        <span class="login-icon">❄️</span>
        <h1 class="login-title">欢迎回到雪球</h1>
        <p class="login-subtitle">故事如雪球越滚越大</p>
      </div>

      <!-- 登录表单 -->
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="请输入用户名"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="请输入密码"
            required
          />
        </div>

        <button
          type="submit"
          class="login-btn"
          :disabled="loading"
        >
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>

      <!-- 其他选项 -->
      <div class="login-footer">
        <router-link to="/register" class="register-link">
          还没有账号？立即注册
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 雪球登录页样式 */
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 64px);
  background: linear-gradient(135deg, #e8f0fe 0%, #f8f9fa 100%);
}

.login-card {
  background: white;
  border-radius: 12px;
  padding: 48px 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.login-title {
  font-size: 24px;
  font-weight: 600;
  color: #202124;
  margin: 0 0 8px 0;
}

.login-subtitle {
  font-size: 14px;
  color: #5f6368;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #202124;
}

.form-group input {
  padding: 12px 16px;
  border: 1px solid #dadce0;
  border-radius: 8px;
  font-size: 15px;
  transition: all 0.2s ease;
  outline: none;
}

.form-group input:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.1);
}

.login-btn {
  padding: 12px;
  background: #1a73e8;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;
}

.login-btn:hover:not(:disabled) {
  background: #1557b0;
}

.login-btn:disabled {
  background: #a8c7fa;
  cursor: not-allowed;
}

.login-footer {
  text-align: center;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e8eaed;
}

.register-link {
  color: #1a73e8;
  text-decoration: none;
  font-size: 14px;
}

.register-link:hover {
  text-decoration: underline;
}
</style>
