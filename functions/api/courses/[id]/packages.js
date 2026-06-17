import { json, readJson } from '../../../utils/http.js'
import { toPackage } from '../../../utils/package.js'

// GET /api/courses/:id/packages —— 某课程的课时包列表（按时间，含已用/剩余）
export async function onRequestGet({ env, data, params }) {
  const courseId = Number(params.id)
  const course = await env.DB.prepare('SELECT id FROM courses WHERE id = ? AND user_id = ?').bind(courseId, data.uid).first()
  if (!course) return json({ error: '课程不存在' }, 404)

  const { results } = await env.DB
    .prepare('SELECT * FROM course_packages WHERE course_id = ? ORDER BY id').bind(courseId).all()
  const list = []
  for (const p of results) list.push(await toPackage(env, p))
  return json(list)
}

// POST /api/courses/:id/packages —— 新增/续费课时包（旧的生效包自动归档）
export async function onRequestPost({ env, data, request, params }) {
  const courseId = Number(params.id)
  const course = await env.DB.prepare('SELECT id FROM courses WHERE id = ? AND user_id = ?').bind(courseId, data.uid).first()
  if (!course) return json({ error: '课程不存在' }, 404)

  const b = await readJson(request)
  const total = Number(b.total)
  if (!total || total <= 0) return json({ error: '请填写购买总课时' }, 400)
  const openingUsed = Math.max(0, Number(b.used) || 0)   // 新建时无记录，已上即期初已用

  // 旧的生效包归档
  await env.DB.prepare("UPDATE course_packages SET status = 'done' WHERE course_id = ? AND status = 'active'").bind(courseId).run()

  const r = await env.DB.prepare(
    `INSERT INTO course_packages (course_id, total_hours, opening_used, purchase_date, amount, status)
     VALUES (?, ?, ?, ?, ?, 'active')`
  ).bind(courseId, total, openingUsed, b.purchaseDate || null, b.amount != null ? Number(b.amount) : null).run()
  return json({ id: r.meta.last_row_id })
}
