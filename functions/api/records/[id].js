import { json, readJson } from '../../utils/http.js'
import { calcDuration, activePackageId, resolveFee } from '../../utils/record.js'

// PUT /api/records/:id —— 更新记录（重新计算课时绑定）
export async function onRequestPut({ env, data, request, params }) {
  const id = Number(params.id)
  const rec = await env.DB.prepare('SELECT * FROM records WHERE id = ? AND user_id = ?').bind(id, data.uid).first()
  if (!rec) return json({ error: '记录不存在' }, 404)

  const b = await readJson(request)
  const courseId = b.courseId || rec.course_id
  const course = await env.DB.prepare('SELECT id, track_hours, bill_mode, default_fee FROM courses WHERE id = ? AND user_id = ?')
    .bind(courseId, data.uid).first()
  if (!course) return json({ error: '课程不存在' }, 404)

  const status = b.status || rec.status
  const startTime = b.startTime !== undefined ? b.startTime : rec.start_time
  const endTime = b.endTime !== undefined ? b.endTime : rec.end_time
  const duration = calcDuration(startTime, endTime, b.duration != null ? b.duration : rec.duration)
  const note = b.note !== undefined ? b.note : rec.note

  // 课时绑定：到课且统计课时才占用课时包
  let packageId = null, consumed = null
  if (course.track_hours && status === 'attended') {
    // 保留原绑定的包（若仍有效），否则取当前生效包
    packageId = rec.package_id || await activePackageId(env, course.id)
    consumed = b.consumedHours != null ? Number(b.consumedHours) : (rec.consumed_hours != null ? rec.consumed_hours : 1)
  }
  // 单节花费：客户端传了 fee 用之，否则沿用原值（仍按计费方式/状态约束）
  const feeInput = b.fee !== undefined ? b.fee : rec.fee
  const fee = resolveFee(course, status, feeInput)

  await env.DB.prepare(
    `UPDATE records SET date=?, course_id=?, start_time=?, end_time=?, duration=?, status=?, package_id=?, consumed_hours=?, fee=?, note=?, updated_at=datetime('now')
     WHERE id=? AND user_id=?`
  ).bind(b.date || rec.date, courseId, startTime || null, endTime || null, duration, status, packageId, consumed, fee, note, id, data.uid).run()
  return json({ ok: true })
}

// DELETE /api/records/:id —— 删除记录
export async function onRequestDelete({ env, data, params }) {
  const id = Number(params.id)
  const rec = await env.DB.prepare('SELECT id FROM records WHERE id = ? AND user_id = ?').bind(id, data.uid).first()
  if (!rec) return json({ error: '记录不存在' }, 404)
  // 先删 R2 里的照片对象，再删元数据与记录
  const photos = (await env.DB.prepare('SELECT r2_key FROM photos WHERE record_id = ?').bind(id).all()).results
  for (const p of photos) { try { await env.PHOTOS.delete(p.r2_key) } catch {} }
  await env.DB.prepare('DELETE FROM photos WHERE record_id = ?').bind(id).run()
  await env.DB.prepare('DELETE FROM records WHERE id = ? AND user_id = ?').bind(id, data.uid).run()
  return json({ ok: true })
}
