import { json, readJson } from '../utils/http.js'
import { toRecord, calcDuration, activePackageId, resolveFee, recordCost, recordSeq } from '../utils/record.js'

// GET /api/records?month=YYYY-MM 或 ?date=YYYY-MM-DD —— 取月/日的上课记录
export async function onRequestGet({ env, data, request }) {
  const url = new URL(request.url)
  const month = url.searchParams.get('month')
  const date = url.searchParams.get('date')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (date) {
    const rows = (await env.DB.prepare('SELECT * FROM records WHERE user_id = ? AND date = ? ORDER BY start_time, id')
      .bind(data.uid, date).all()).results
    const recs = rows.map(toRecord)
    // 按日查询时附带照片 id 列表（供当日抽屉展示缩略图）+ 本节花费（供详情展示）
    for (const rec of recs) {
      const ph = (await env.DB.prepare('SELECT id FROM photos WHERE record_id = ? ORDER BY id').bind(rec.id).all()).results
      rec.photos = ph.map(p => p.id)
      rec.cost = await recordCost(env, rec)
      const sq = await recordSeq(env, rec)
      if (sq) { rec.seq = sq.seq; rec.seqTotal = sq.total }
    }
    return json(recs)
  } else if (month) {
    const rows = (await env.DB.prepare("SELECT * FROM records WHERE user_id = ? AND date LIKE ? ORDER BY date, start_time")
      .bind(data.uid, month + '-%').all()).results
    return json(rows.map(toRecord))
  } else if (from && to) {
    const rows = (await env.DB.prepare("SELECT * FROM records WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date, start_time")
      .bind(data.uid, from, to).all()).results
    return json(rows.map(toRecord))
  }
  return json({ error: '缺少 month / date / from-to 参数' }, 400)
}

// POST /api/records —— 新增一条上课记录（到课且课程统计课时时，自动绑定当前课时包扣减）
export async function onRequestPost({ env, data, request }) {
  const b = await readJson(request)
  if (!b.date || !b.courseId) return json({ error: '缺少日期或课程' }, 400)

  const course = await env.DB.prepare('SELECT id, track_hours, bill_mode, default_fee FROM courses WHERE id = ? AND user_id = ?')
    .bind(b.courseId, data.uid).first()
  if (!course) return json({ error: '课程不存在' }, 404)

  const status = b.status || 'attended'
  const duration = calcDuration(b.startTime, b.endTime, b.duration)
  let packageId = null, consumed = null
  if (course.track_hours && status === 'attended') {
    packageId = await activePackageId(env, course.id)
    consumed = b.consumedHours != null ? Number(b.consumedHours) : 1
  }
  // 单节付费且到课：本节花费取传入值，未传则回落课程单节默认价（请假/调课不计费）
  const fee = resolveFee(course, status, b.fee)

  const r = await env.DB.prepare(
    `INSERT INTO records (user_id, date, course_id, start_time, end_time, duration, status, package_id, consumed_hours, fee, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(data.uid, b.date, course.id, b.startTime || null, b.endTime || null, duration, status, packageId, consumed, fee, b.note || null).run()
  return json({ id: r.meta.last_row_id })
}
