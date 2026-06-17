// 轻量 fetch 封装：自动 JSON 序列化、带同源凭据、非 2xx 抛错
export async function api(path, options = {}) {
  const opt = { credentials: 'same-origin', ...options }
  if (opt.body && typeof opt.body !== 'string') {
    opt.headers = { 'Content-Type': 'application/json', ...(opt.headers || {}) }
    opt.body = JSON.stringify(opt.body)
  }
  const r = await fetch(path, opt)
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || ('请求失败 ' + r.status))
  return data
}
