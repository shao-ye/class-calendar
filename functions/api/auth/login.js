import { verifyPassword, signSession } from '../../utils/auth.js'

// POST /api/auth/login —— 用户名 + 密码登录，成功后下发会话 Cookie
export async function onRequestPost({ request, env }) {
  const { username, password } = await request.json().catch(() => ({}))
  if (!username || !password) return json({ error: '请输入用户名和密码' }, 400)

  // 查询用户
  const user = await env.DB
    .prepare('SELECT id, username, password_hash, display_name FROM users WHERE username = ?')
    .bind(username).first()
  if (!user || !user.password_hash) return json({ error: '用户名或密码错误' }, 401)

  // 校验密码
  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) return json({ error: '用户名或密码错误' }, 401)

  // 签发 30 天有效的会话
  const maxAge = 30 * 24 * 3600
  const token = await signSession({ uid: user.id, exp: Date.now() + maxAge * 1000 }, env.SESSION_SECRET)

  const headers = new Headers({ 'Content-Type': 'application/json' })
  headers.append('Set-Cookie', `session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`)
  return new Response(JSON.stringify({ id: user.id, username: user.username, displayName: user.display_name }), { headers })
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
}
