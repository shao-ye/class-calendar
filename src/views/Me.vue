<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'

const router = useRouter()
const user = ref(null)
const toastMsg = ref('')

// 手动同步法定假日（当年+次年）
async function syncHolidays() {
  toast('同步中…')
  try { const r = await api('/api/holidays/sync', { method: 'POST', body: {} }); toast('已同步 ' + r.count + ' 天假日数据') }
  catch (e) { toast('同步失败：' + e.message) }
}

onMounted(async () => {
  const r = await fetch('/api/auth/me')
  if (r.ok) user.value = await r.json()
})

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' })
  router.push('/login')
}
function toast(msg) { toastMsg.value = msg; setTimeout(() => (toastMsg.value = ''), 1800) }
</script>

<template>
  <div class="wrap">
    <div class="topbar"><div class="title">我的</div><div class="sub">账号与设置</div></div>

    <div class="profile">
      <div class="avatar">👨‍👧</div>
      <div class="name">{{ user?.displayName || user?.username || '—' }}</div>
      <div class="tag">单用户模式（一期）</div>
    </div>

    <div class="list">
      <div class="row" @click="syncHolidays">🗓️ 同步法定假日<span class="arr">›</span></div>
      <div class="row" @click="toast('导出功能规划在后续版本')">📤 导出记录（CSV）<span class="arr">›</span></div>
      <div class="row" @click="toast('二期功能：开放多用户注册')">👥 多用户管理<span class="arr">二期 ›</span></div>
      <div class="row" @click="toast('远期功能：绑定微信登录')">💬 绑定微信登录<span class="arr">远期 ›</span></div>
      <div class="row danger" @click="logout">退出登录<span class="arr">›</span></div>
    </div>

    <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
  </div>
</template>

<style scoped>
.wrap { min-height: 100vh; padding-bottom: 80px; }
.topbar { background: var(--card); padding: 14px 16px; border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 10; }
.title { font-size: 18px; font-weight: 700; }
.sub { font-size: 12px; color: var(--text-sub); }
.profile { background: var(--card); margin: 12px; border-radius: 16px; padding: 24px; text-align: center; box-shadow: var(--shadow); }
.avatar { font-size: 46px; }
.name { font-weight: 700; font-size: 17px; margin-top: 6px; }
.tag { font-size: 12px; color: var(--text-sub); margin-top: 2px; }
.list { background: var(--card); margin: 12px; border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
.row { padding: 15px 16px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; cursor: pointer; }
.row:last-child { border-bottom: none; }
.row.danger { color: #e8694a; }
.arr { color: var(--text-sub); }
.toast { position: fixed; left: 50%; bottom: 90px; transform: translateX(-50%); background: rgba(0,0,0,.8); color: #fff; font-size: 13px; padding: 9px 16px; border-radius: 20px; z-index: 80; }
</style>
