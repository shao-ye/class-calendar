<script setup>
// 根组件：路由出口 + 底部 Tab 导航（登录页不显示）
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const tabs = [
  { path: '/', icon: '📅', label: '日历' },
  { path: '/stats', icon: '📊', label: '统计' },
  { path: '/courses', icon: '🏷️', label: '课程' },
  { path: '/me', icon: '👤', label: '我的' }
]
const showTabs = computed(() => route.path !== '/login')
</script>

<template>
  <router-view />
  <nav v-if="showTabs" class="tabbar">
    <button v-for="t in tabs" :key="t.path" :class="{ on: route.path === t.path }" @click="router.push(t.path)">
      <span class="ic">{{ t.icon }}</span>{{ t.label }}
    </button>
  </nav>
</template>

<style scoped>
.tabbar { position: fixed; left: 50%; transform: translateX(-50%); bottom: 0; width: 100%; max-width: 420px; background: #fff; border-top: 1px solid var(--line); display: flex; z-index: 30; }
.tabbar button { flex: 1; padding: 9px 0 10px; display: flex; flex-direction: column; align-items: center; gap: 2px; color: var(--text-sub); font-size: 11px; background: none; border: none; cursor: pointer; }
.tabbar button.on { color: var(--primary); }
.tabbar .ic { font-size: 20px; line-height: 1; }
</style>
