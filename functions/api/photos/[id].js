import { json } from '../../utils/http.js'

// GET /api/photos/:id —— 从 R2 读取并返回图片（按 user 校验归属）
export async function onRequestGet({ env, data, params }) {
  const id = Number(params.id)
  const row = await env.DB
    .prepare('SELECT p.r2_key FROM photos p JOIN records r ON r.id = p.record_id WHERE p.id = ? AND r.user_id = ?')
    .bind(id, data.uid).first()
  if (!row) return new Response('not found', { status: 404 })
  const obj = await env.PHOTOS.get(row.r2_key)
  if (!obj) return new Response('not found', { status: 404 })
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'private, max-age=3600')
  return new Response(obj.body, { headers })
}

// DELETE /api/photos/:id —— 删除照片（R2 对象 + 元数据）
export async function onRequestDelete({ env, data, params }) {
  const id = Number(params.id)
  const row = await env.DB
    .prepare('SELECT p.id, p.r2_key FROM photos p JOIN records r ON r.id = p.record_id WHERE p.id = ? AND r.user_id = ?')
    .bind(id, data.uid).first()
  if (!row) return json({ error: '照片不存在' }, 404)
  await env.PHOTOS.delete(row.r2_key)
  await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(id).run()
  return json({ ok: true })
}
