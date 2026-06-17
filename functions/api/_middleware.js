import { verifySession, getCookie } from '../utils/auth.js'

// 所有 /api/* 请求的前置中间件：放行登录/登出，其余校验会话并注入 user_id
export async function onRequest(context) {
  const { request, env, next, data } = context
  const url = new URL(request.url)

  // 无需登录即可访问的开放接口
  const open = ['/api/auth/login', '/api/auth/logout']
  if (open.includes(url.pathname)) return next()

  const token = getCookie(request, 'session')
  const payload = await verifySession(token, env.SESSION_SECRET)
  if (!payload || (payload.exp && payload.exp < Date.now())) {
    return new Response(JSON.stringify({ error: '未登录' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    })
  }

  // 将当前用户 id 透传给后续处理函数
  data.uid = payload.uid
  return next()
}
