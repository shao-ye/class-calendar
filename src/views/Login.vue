<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = ref('parent')
const password = ref('')
const error = ref('')
const loading = ref(false)

// 提交登录：调用 /api/auth/login，成功跳转首页
async function doLogin() {
  error.value = ''
  if (!username.value || !password.value) { error.value = '请输入用户名和密码'; return }
  loading.value = true
  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    })
    const data = await r.json()
    if (!r.ok) { error.value = data.error || '登录失败'; return }
    router.push('/')
  } catch {
    error.value = '网络错误，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <div class="logo">📚</div>
    <h1>课程小日历</h1>
    <p>记录孩子每天上了什么课</p>
    <div class="box">
      <input v-model="username" type="text" placeholder="用户名" @keyup.enter="doLogin" />
      <input v-model="password" type="password" placeholder="密码" @keyup.enter="doLogin" />
      <div v-if="error" class="err">{{ error }}</div>
      <button :disabled="loading" @click="doLogin">{{ loading ? '登录中…' : '登录' }}</button>
    </div>
    <div class="tip">默认账号 parent，密码见 seed.sql（123456）</div>
  </div>
</template>

<style scoped>
.login{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:30px;background:linear-gradient(160deg,#3b6cff,#6b8cff);}
.logo{font-size:54px;margin-bottom:10px;}
h1{color:#fff;font-size:22px;margin:0 0 4px;}
p{color:rgba(255,255,255,.85);font-size:13px;margin:0 0 30px;}
.box{background:#fff;border-radius:18px;padding:22px;width:100%;box-shadow:var(--shadow);}
.box input{width:100%;padding:13px;border:1px solid var(--line);border-radius:11px;
  font-size:15px;margin-bottom:12px;outline:none;}
.box input:focus{border-color:var(--primary);}
.box button{width:100%;padding:13px;border-radius:11px;background:var(--primary);
  color:#fff;font-weight:700;font-size:15px;}
.box button:disabled{opacity:.6;}
.err{color:#e8694a;font-size:13px;margin-bottom:10px;}
.tip{color:rgba(255,255,255,.8);font-size:12px;margin-top:18px;text-align:center;}
</style>
