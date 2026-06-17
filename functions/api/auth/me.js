// GET /api/auth/me —— 返回当前登录用户信息（中间件已校验会话，uid 由 data 注入）
export async function onRequestGet({ env, data }) {
  const user = await env.DB
    .prepare('SELECT id, username, display_name FROM users WHERE id = ?')
    .bind(data.uid).first()
  if (!user) return new Response(JSON.stringify({ error: '未登录' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  return new Response(JSON.stringify({ id: user.id, username: user.username, displayName: user.display_name }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
