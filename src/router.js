import { createRouter, createWebHistory } from 'vue-router'
import Login from './views/Login.vue'
import Calendar from './views/Calendar.vue'
import Stats from './views/Stats.vue'
import Courses from './views/Courses.vue'
import Me from './views/Me.vue'

// 路由表：登录页 + 四个 Tab（日历/统计/课程/我的）
const routes = [
  { path: '/login', component: Login },
  { path: '/', component: Calendar, meta: { requiresAuth: true } },
  { path: '/stats', component: Stats, meta: { requiresAuth: true } },
  { path: '/courses', component: Courses, meta: { requiresAuth: true } },
  { path: '/me', component: Me, meta: { requiresAuth: true } }
]

const router = createRouter({ history: createWebHistory(), routes })

// 全局前置守卫：进入需要登录的页面前，调用 /api/auth/me 校验会话
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true
  try {
    const r = await fetch('/api/auth/me')
    return r.ok ? true : '/login'
  } catch {
    return '/login'
  }
})

export default router
