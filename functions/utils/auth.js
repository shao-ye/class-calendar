// 认证工具：PBKDF2 密码哈希 + HMAC 会话签名
// 全部基于 Web Crypto（globalThis.crypto.subtle），在 Cloudflare Workers 与 Node 22 下均可用

const ITER = 100000
const enc = new TextEncoder()

// 生成密码哈希，格式：pbkdf2$迭代次数$saltBase64$hashBase64
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await deriveBits(password, salt, ITER)
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(new Uint8Array(bits))}`
}

// 校验密码是否与存储的哈希匹配
export async function verifyPassword(password, stored) {
  const parts = (stored || '').split('$')
  if (parts.length !== 4) return false
  const iter = parseInt(parts[1], 10)
  const salt = unb64(parts[2])
  const bits = await deriveBits(password, salt, iter)
  return b64(new Uint8Array(bits)) === parts[3]
}

// 从口令派生 256bit 密钥位
async function deriveBits(password, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, key, 256)
}

// 签发会话令牌：body.签名（均为 base64url）
export async function signSession(payload, secret) {
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const sig = await hmac(body, secret)
  return `${body}.${sig}`
}

// 校验会话令牌，合法返回 payload，否则返回 null
export async function verifySession(token, secret) {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expect = await hmac(body, secret)
  if (sig !== expect) return null
  try { return JSON.parse(new TextDecoder().decode(unb64url(body))) } catch { return null }
}

// HMAC-SHA256 签名，返回 base64url
async function hmac(data, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return b64url(new Uint8Array(sig))
}

// 从请求中读取指定 Cookie
export function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || ''
  const m = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

// ---- base64 / base64url 辅助 ----
function b64(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s) }
function unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)) }
function b64url(bytes) { return b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
function unb64url(s) { return unb64(s.replace(/-/g, '+').replace(/_/g, '/')) }
