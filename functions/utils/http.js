// HTTP 辅助：统一 JSON 响应与请求体解析

// 返回 JSON 响应
export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
}

// 解析请求 JSON 体，失败返回空对象
export async function readJson(request) {
  return request.json().catch(() => ({}))
}
