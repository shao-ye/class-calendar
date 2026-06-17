import { json, readJson } from '../../utils/http.js'
import { weekdaysToStr } from '../../utils/course.js'

// PUT /api/courses/:id —— 更新课程
export async function onRequestPut({ env, data, request, params }) {
  const id = Number(params.id)
  const b = await readJson(request)
  if (!b.name || !b.name.trim()) return json({ error: '请填写课程名称' }, 400)

  // 校验归属
  const own = await env.DB.prepare('SELECT id FROM courses WHERE id = ? AND user_id = ?').bind(id, data.uid).first()
  if (!own) return json({ error: '课程不存在' }, 404)

  try {
    await env.DB.prepare(
      `UPDATE courses SET name=?, color=?, default_start=?, default_duration=?, weekdays=?, skip_holiday=?, track_hours=?, note=?
       WHERE id=? AND user_id=?`
    ).bind(
      b.name.trim(), b.color || '#3b6cff', b.defaultStart || null, b.defaultDuration || 60,
      weekdaysToStr(b.weekdays), b.skipHoliday ? 1 : 0, b.trackHours ? 1 : 0,
      b.note && b.note.trim() ? b.note.trim() : null, id, data.uid
    ).run()
    return json({ ok: true })
  } catch (e) {
    return json({ error: '课程名已存在' }, 409)
  }
}

// DELETE /api/courses/:id —— 删除课程（已有上课记录则软停用，保留历史）
export async function onRequestDelete({ env, data, params }) {
  const id = Number(params.id)
  const own = await env.DB.prepare('SELECT id FROM courses WHERE id = ? AND user_id = ?').bind(id, data.uid).first()
  if (!own) return json({ error: '课程不存在' }, 404)

  const cnt = await env.DB.prepare('SELECT COUNT(*) AS n FROM records WHERE course_id = ? AND user_id = ?').bind(id, data.uid).first()
  if (cnt.n > 0) {
    await env.DB.prepare('UPDATE courses SET is_active = 0 WHERE id = ? AND user_id = ?').bind(id, data.uid).run()
    return json({ ok: true, softDeleted: true, records: cnt.n })
  }
  await env.DB.prepare('DELETE FROM courses WHERE id = ? AND user_id = ?').bind(id, data.uid).run()
  return json({ ok: true })
}
