<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import http from '@/api/http'
import AppButton from '@/components/AppButton.vue'
import AppInput from '@/components/AppInput.vue'

const router = useRouter()
const userStore = useUserStore()
const activeMenu = ref<'password' | 'username' | 'email' | 'delete'>('password')

const menuItems = [
  { key: 'password' as const, label: '修改密码', icon: '🔑' },
  { key: 'username' as const, label: '修改用户名', icon: '✏️' },
  { key: 'email' as const, label: '修改邮箱', icon: '📧' },
  { key: 'delete' as const, label: '注销账户', icon: '⚠️', danger: true },
]

// ── 改密码 ──
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const pLoading = ref(false)
const pErr = ref('')
const pOk = ref(false)

const handleChangePassword = async () => {
  pErr.value = ''
  if (!oldPassword.value || !newPassword.value) { pErr.value = '请填写所有字段'; return }
  if (newPassword.value.length < 8) { pErr.value = '新密码长度至少为8位'; return }
  if (newPassword.value !== confirmPassword.value) { pErr.value = '两次输入的新密码不一致'; return }
  pLoading.value = true
  try {
    await http.put('/users/me/password', { oldPassword: oldPassword.value, newPassword: newPassword.value })
    pOk.value = true
  } catch (error: any) {
    pErr.value = error.message || '修改失败'
  } finally {
    pLoading.value = false
  }
}

// ── 改用户名 ──
const newUsername = ref('')
const uLoading = ref(false)
const uErr = ref('')
const uOk = ref(false)

const handleChangeUsername = async () => {
  uErr.value = ''
  if (newUsername.value.length < 3 || newUsername.value.length > 20) {
    uErr.value = '用户名长度需在3-20之间'; return
  }
  uLoading.value = true
  try {
    await http.put('/users/me/username', { username: newUsername.value })
    userStore.fetchUserInfo()
    uOk.value = true
  } catch (error: any) {
    uErr.value = error.message || '修改失败'
  } finally {
    uLoading.value = false
  }
}

// ── 改邮箱 ──
const newEmail = ref('')
const emailCode = ref('')
const eStep = ref<'input' | 'verify'>('input')
const eLoading = ref(false)
const eErr = ref('')
const eOk = ref(false)

const handleChangeEmail = async () => {
  eErr.value = ''
  if (!newEmail.value) { eErr.value = '请输入新邮箱'; return }
  eLoading.value = true
  try {
    await http.put('/users/me/email', { newEmail: newEmail.value })
    eStep.value = 'verify'
  } catch (error: any) {
    eErr.value = error.message || '发送失败'
  } finally {
    eLoading.value = false
  }
}

const handleVerifyEmail = async () => {
  eErr.value = ''
  if (!emailCode.value) { eErr.value = '请输入验证码'; return }
  eLoading.value = true
  try {
    await http.post('/users/me/email/verify', { code: emailCode.value })
    userStore.fetchUserInfo()
    eOk.value = true
  } catch (error: any) {
    eErr.value = error.message || '验证失败'
  } finally {
    eLoading.value = false
  }
}

// ── 注销账户 ──
const deletePassword = ref('')
const dLoading = ref(false)
const dErr = ref('')
const showConfirm = ref(false)

const handleDeleteAccount = async () => {
  dErr.value = ''
  if (!showConfirm.value) { showConfirm.value = true; return }
  if (!deletePassword.value) { dErr.value = '请输入密码'; return }
  dLoading.value = true
  try {
    await http.delete('/users/me', { data: { password: deletePassword.value } })
    userStore.logout()
    router.push('/')
  } catch (error: any) {
    dErr.value = error.message || '注销失败'
    showConfirm.value = false
  } finally {
    dLoading.value = false
  }
}
</script>

<template>
  <div class="settings-layout">
    <!-- 左侧菜单 -->
    <aside class="settings-sidebar">
      <h3 class="sidebar-title">账户设置</h3>
      <nav class="sidebar-menu">
        <button
          v-for="item in menuItems"
          :key="item.key"
          :class="[{ active: activeMenu === item.key }, item.danger ? 'danger' : '']"
          @click="activeMenu = item.key; pOk = false; uOk = false; eOk = false; eStep = 'input'; pErr = ''; uErr = ''; eErr = ''; dErr = ''; showConfirm = false"
        >
          <span class="menu-icon">{{ item.icon }}</span>
          {{ item.label }}
        </button>
      </nav>
    </aside>

    <!-- 右侧内容 -->
    <main class="settings-content">
      <h2 class="content-title">{{ menuItems.find(m => m.key === activeMenu)?.label }}</h2>

      <!-- 修改密码 -->
      <div v-if="activeMenu === 'password'" class="panel">
        <div v-if="pOk" class="success-box">密码修改成功</div>
        <div v-else-if="pErr" class="error-box">{{ pErr }}</div>
        <form v-if="!pOk" @submit.prevent="handleChangePassword" class="settings-form">
          <label class="field-label">原密码</label>
          <AppInput v-model="oldPassword" type="password" placeholder="输入原密码" />
          <label class="field-label">新密码</label>
          <AppInput v-model="newPassword" type="password" placeholder="新密码（至少8位）" />
          <label class="field-label">确认新密码</label>
          <AppInput v-model="confirmPassword" type="password" placeholder="再次输入新密码" />
          <AppButton type="submit" :loading="pLoading" class="submit-btn">保存修改</AppButton>
        </form>
      </div>

      <!-- 修改用户名 -->
      <div v-if="activeMenu === 'username'" class="panel">
        <div v-if="uOk" class="success-box">用户名已修改为「{{ newUsername }}」</div>
        <div v-else-if="uErr" class="error-box">{{ uErr }}</div>
        <form v-if="!uOk" @submit.prevent="handleChangeUsername" class="settings-form">
          <label class="field-label">当前用户名</label>
          <p class="current-value">{{ userStore.userInfo?.username }}</p>
          <label class="field-label">新用户名</label>
          <AppInput v-model="newUsername" placeholder="3-20个字符" />
          <AppButton type="submit" :loading="uLoading" class="submit-btn">保存修改</AppButton>
        </form>
      </div>

      <!-- 修改邮箱 -->
      <div v-if="activeMenu === 'email'" class="panel">
        <div v-if="eOk" class="success-box">邮箱已修改为「{{ newEmail }}」</div>
        <div v-else-if="eErr" class="error-box">{{ eErr }}</div>
        <template v-if="!eOk">
          <template v-if="eStep === 'input'">
            <form @submit.prevent="handleChangeEmail" class="settings-form">
              <label class="field-label">当前邮箱</label>
              <p class="current-value">{{ userStore.userInfo?.email || '未设置' }}</p>
              <label class="field-label">新邮箱</label>
              <AppInput v-model="newEmail" type="email" placeholder="输入新邮箱地址" />
              <AppButton type="submit" :loading="eLoading" class="submit-btn">发送验证码</AppButton>
            </form>
          </template>
          <template v-else>
            <form @submit.prevent="handleVerifyEmail" class="settings-form">
              <label class="field-label">验证码已发送至 {{ newEmail }}</label>
              <AppInput v-model="emailCode" placeholder="输入6位验证码" />
              <AppButton type="submit" :loading="eLoading" class="submit-btn">确认换绑</AppButton>
              <button type="button" class="link-btn" @click="eStep = 'input'; eErr = ''">重新输入邮箱</button>
            </form>
          </template>
        </template>
      </div>

      <!-- 注销账户 -->
      <div v-if="activeMenu === 'delete'" class="panel">
        <div v-if="dErr" class="error-box">{{ dErr }}</div>
        <form @submit.prevent="handleDeleteAccount" class="settings-form">
          <div class="warning-box">
            注销后所有数据保留但无法登录，此操作不可撤销。
          </div>
          <label class="field-label">确认密码</label>
          <AppInput v-model="deletePassword" type="password" placeholder="输入当前密码确认" />
          <template v-if="!showConfirm">
            <AppButton type="submit" class="delete-btn">注销账户</AppButton>
          </template>
          <template v-else>
            <p class="confirm-text">确定要注销账户吗？此操作不可撤销。</p>
            <div class="confirm-actions">
              <button type="button" class="cancel-btn" @click="showConfirm = false; dErr = ''">取消</button>
              <AppButton type="submit" :loading="dLoading" class="delete-btn">确认注销</AppButton>
            </div>
          </template>
        </form>
      </div>
    </main>
  </div>
</template>

<style scoped>
.settings-layout {
  display: flex;
  gap: 32px;
  max-width: 960px;
  margin: 0 auto;
  min-height: 70vh;
}

/* ── 左侧菜单 ── */
.settings-sidebar {
  width: 200px;
  flex-shrink: 0;
  padding-top: 8px;
}

.sidebar-title {
  font-size: 18px;
  font-weight: 500;
  color: #202124;
  margin: 0 0 20px 0;
  padding-left: 12px;
}

.sidebar-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #5f6368;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.sidebar-menu button:hover {
  background: #f1f3f4;
  color: #202124;
}

.sidebar-menu button.active {
  background: #e8f0fe;
  color: #1a73e8;
  font-weight: 500;
}

.sidebar-menu button.danger.active {
  background: #fce8e6;
  color: #c5221f;
  font-weight: 500;
}

.menu-icon {
  font-size: 16px;
}

/* ── 右侧内容 ── */
.settings-content {
  flex: 1;
  min-width: 0;
}

.content-title {
  font-size: 20px;
  font-weight: 500;
  color: #202124;
  margin: 0 0 24px 0;
}

.panel {
  background: #fff;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border: 1px solid #e8eaed;
  max-width: 480px;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-label {
  font-size: 13px;
  font-weight: 500;
  color: #5f6368;
  margin-top: 8px;
}

.field-label:first-child {
  margin-top: 0;
}

.current-value {
  font-size: 14px;
  color: #202124;
  padding: 8px 0;
  margin: 0;
}

.submit-btn {
  margin-top: 12px;
  align-self: flex-start;
}

.link-btn {
  background: none;
  border: none;
  color: #1a73e8;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
  align-self: flex-start;
}

.link-btn:hover {
  text-decoration: underline;
}

.error-box {
  background: #fce8e6;
  color: #c5221f;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 20px;
}

.success-box {
  background: #e6f4ea;
  color: #137333;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 20px;
}

.warning-box {
  background: #fef7e0;
  color: #b06000;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.confirm-text {
  font-size: 14px;
  color: #c5221f;
  font-weight: 500;
  margin: 8px 0 0 0;
}

.confirm-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.delete-btn {
  align-self: flex-start;
  margin-top: 12px;
  background: #c5221f !important;
  border-color: #c5221f !important;
}

.cancel-btn {
  padding: 8px 20px;
  border: 1px solid #dadce0;
  background: #fff;
  color: #5f6368;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.cancel-btn:hover {
  background: #f1f3f4;
}
</style>
