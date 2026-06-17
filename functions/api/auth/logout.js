// POST /api/auth/logout —— 清除会话 Cookie
export async function onRequestPost() {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  headers.append('Set-Cookie', 'session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0')
  return new Response(JSON.stringify({ ok: true }), { headers })
}
