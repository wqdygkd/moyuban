<script setup>
import { Lock, Message } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const formRef = ref()
const loading = ref(false)
const message = ref('')

const supabaseReady = computed(() => !!supabase)

const form = reactive({
  email: '',
  password: '',
})

const rules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
}

async function validate() {
  try {
    await formRef.value.validate()
    return true
  } catch {
    return false
  }
}

async function submit() {
  if (!(await validate())) return
  loading.value = true
  message.value = ''
  try {
    await auth.loginWithPassword(form.email, form.password)
    ElMessage.success('登录成功')
    const redirect = route.query.redirect || '/'
    router.push(String(redirect))
  } catch (e) {
    message.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-head">
        <span class="login-logo">摸</span>
        <h2 class="login-title">
          摸鱼办 · 登录
        </h2>
        <p class="login-sub">
          登录后即可维护网址导航数据
        </p>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent>
        <el-form-item prop="email">
          <el-input v-model="form.email" placeholder="邮箱账号" :prefix-icon="Message" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" show-password :prefix-icon="Lock" @keyup.enter="submit" />
        </el-form-item>

        <el-alert v-if="message" class="msg" :title="message" type="error" :closable="false" />

        <el-button type="primary" class="submit-btn" :loading="loading" @click="submit">
          登 录
        </el-button>
      </el-form>

      <p v-if="!supabaseReady" class="config-warn">
        尚未配置 Supabase，请在项目根目录 .env 中设置 VITE_SUPABASE_URL 与 VITE_SUPABASE_PUBLISHABLE_KEY
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}
.login-card {
  width: 100%;
  max-width: 420px;
  background: var(--card-bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  padding: var(--space-9) var(--space-9) var(--space-7);
  box-shadow: var(--shadow-dialog);
}
.login-head {
  text-align: center;
  margin-bottom: var(--space-6);
}
.login-logo {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-card);
  background: var(--grad-brand);
  color: var(--text-on-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 700;
  margin-bottom: var(--space-3);
}
.login-title {
  margin: 0 0 var(--space-hair);
  font-size: var(--text-xl);
  color: var(--text-main);
}
.login-sub {
  margin: 0;
  font-size: var(--text-foot);
  color: var(--text-sub);
}
.submit-btn {
  width: 100%;
}
.msg {
  margin-bottom: var(--space-3);
}
.config-warn {
  margin: 18px 0 0;
  font-size: var(--text-xxs);
  color: var(--el-color-warning);
  text-align: center;
}
</style>
