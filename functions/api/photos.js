import { json } from '../utils/http.js'

// POST /api/photos —— 上传照片到 R2 并写入元数据（multipart: recordId + file）
export async function onRequestPost({ env, data, request }) {
  const form = await request.formData().catch(() => null)
  if (!form) return json({ error: '请求格式错误' }, 400)
  const recordId = Number(form.get('recordId'))
  const file = form.get('file')
  if (!recordId || !file || typeof file === 'string') return json({ error: '缺少 recordId 或文件' }, 400)

  // 校验记录归属
  const rec = await env.DB.prepare('SELECT id FROM records WHERE id = ? AND user_id = ?').bind(recordId, data.uid).first()
  if (!rec) return json({ error: '记录不存在' }, 404)

  const type = file.type || 'image/jpeg'
  const ext = type.includes('png') ? 'png' : (type.includes('webp') ? 'webp' : 'jpg')
  const key = `u${data.uid}/r${recordId}/${crypto.randomUUID()}.${ext}`
  await env.PHOTOS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: type } })

  const r = await env.DB.prepare('INSERT INTO photos (record_id, r2_key) VALUES (?, ?)').bind(recordId, key).run()
  return json({ id: r.meta.last_row_id })
}
