import { json, readJson } from '../utils/http.js'
import { toCourse, weekdaysToStr, normalizeBillMode } from '../utils/course.js'
import { toPackage } from '../utils/package.js'

// GET /api/courses —— 当前用户的课程库列表（统计课时的课附带当前生效课时包）
export async function onRequestGet({ env, data }) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, color, default_start, default_duration, weekdays, skip_holiday, track_hours, bill_mode, default_fee, note
     FROM courses WHERE user_id = ? AND is_active = 1 ORDER BY id`
  ).bind(data.uid).all()

  const list = []
  for (const row of results) {
    const c = toCourse(row)
    if (c.trackHours) {
      const ap = await env.DB
        .prepare("SELECT * FROM course_packages WHERE course_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1")
        .bind(row.id).first()
      c.activePackage = ap ? await toPackage(env, ap) : null
    }
    list.push(c)
  }
  return json(list)
}

// POST /api/courses —— 新建课程
export async function onRequestPost({ env, data, request }) {
  const b = await readJson(request)
  if (!b.name || !b.name.trim()) return json({ error: '请填写课程名称' }, 400)
  // 计费方式：优先用 billMode；兼容老客户端只传 trackHours 的情况
  const billMode = normalizeBillMode(b.billMode != null ? b.billMode : (b.trackHours ? 'package' : 'none'))
  const trackHours = billMode === 'package' ? 1 : 0
  const defaultFee = billMode === 'per_session' && b.defaultFee != null && b.defaultFee !== '' ? Number(b.defaultFee) : null
  try {
    const r = await env.DB.prepare(
      `INSERT INTO courses (user_id, name, color, default_start, default_duration, weekdays, skip_holiday, track_hours, bill_mode, default_fee, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.uid, b.name.trim(), b.color || '#3b6cff', b.defaultStart || null,
      b.defaultDuration || 60, weekdaysToStr(b.weekdays), b.skipHoliday ? 1 : 0, trackHours, billMode, defaultFee,
      b.note && b.note.trim() ? b.note.trim() : null
    ).run()
    return json({ id: r.meta.last_row_id })
  } catch (e) {
    // UNIQUE(user_id, name) 冲突
    return json({ error: '课程名已存在' }, 409)
  }
}
