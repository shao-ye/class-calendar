import { json, readJson } from '../../../utils/http.js'
import { ownedPackage } from '../../../utils/package.js'

// POST /api/packages/:pid/backfill —— 把课时包「还没排进日历的已上节数」自动补成过往到课记录
//   body: { maxDate: 'YYYY-MM-DD' }  —— 回填上限（客户端本地今天），不生成未来记录
//
// 模型：目标已上 = 期初已用 + 已有到课记录消耗。回填只补「期初已用」那部分，
//   从今天往前按「上课星期」取最近的空白上课日（跳过法定假日与已有本课程记录），
//   补 = 目标已上 − 已有真实记录。可重复执行：先清除上次自动补的、把其消耗加回期初已用，
//   再按当前记录重新计算，从而与用户手动增删保持一致、不重复、不冲突。
export async function onRequestPost({ env, data, request, params }) {
  const pid = Number(params.pid)
  const pkg = await ownedPackage(env, pid, data.uid)
  if (!pkg) return json({ error: '课时包不存在' }, 404)

  const course = await env.DB.prepare(
    'SELECT id, weekdays, skip_holiday, default_start, default_duration FROM courses WHERE id = ?'
  ).bind(pkg.course_id).first()
  if (!course) return json({ error: '课程不存在' }, 404)

  const weekdays = course.weekdays ? course.weekdays.split(',').map(Number) : []
  if (!weekdays.length) return json({ error: '请先为课程设置上课星期，才能按规则回填' }, 400)

  const b = await readJson(request)
  const maxDate = (b.maxDate && /^\d{4}-\d{2}-\d{2}$/.test(b.maxDate)) ? b.maxDate : fmtYmd(new Date())

  // 1) 幂等：清掉本包上次自动回填的记录，并把其消耗加回期初已用（保持「目标已上」不变）
  const autoRows = (await env.DB
    .prepare("SELECT consumed_hours FROM records WHERE package_id = ? AND note = '历史回填'").bind(pid).all()).results
  if (autoRows.length) {
    const restored = autoRows.reduce((s, r) => s + (r.consumed_hours || 0), 0)
    await env.DB.prepare("DELETE FROM records WHERE package_id = ? AND note = '历史回填'").bind(pid).run()
    await env.DB.prepare('UPDATE course_packages SET opening_used = opening_used + ? WHERE id = ?').bind(restored, pid).run()
    pkg.opening_used = (pkg.opening_used || 0) + restored
  }

  // 2) 需补节数 = 当前期初已用整数部分（= 目标已上 − 已有真实记录）
  const opening = pkg.opening_used || 0
  const count = Math.floor(opening)
  if (count <= 0) return json({ ok: true, created: 0, remaining: 0 })

  // 3) 跳过集合：法定假日（放假日）+ 已有本课程记录的日期（含用户手动补的，避免重复/冲突）
  const holSet = new Set()
  if (course.skip_holiday) {
    const hs = (await env.DB.prepare('SELECT date FROM holidays WHERE is_workday = 0').all()).results
    for (const h of hs) holSet.add(h.date)
  }
  const existing = new Set(
    (await env.DB.prepare('SELECT date FROM records WHERE user_id = ? AND course_id = ?').bind(data.uid, course.id).all())
      .results.map(r => r.date)
  )

  // 4) 从今天往前逐天扫描，取最近的 count 个符合上课星期、且空着的日期
  const startTime = course.default_start || null
  const duration = course.default_duration || 60
  const endTime = startTime ? addMinutes(startTime, duration) : null
  const dates = []
  let d = parseYmd(maxDate)
  let guard = 0
  while (dates.length < count && guard < 4000) {
    guard++
    const key = fmtYmd(d)
    const wd = isoWeekday(d)
    if (weekdays.includes(wd) && !holSet.has(key) && !existing.has(key)) dates.push(key)
    d = addDays(d, -1)
  }
  dates.sort()   // 升序插入，记录按时间排序

  if (dates.length) {
    const stmt = env.DB.prepare(
      `INSERT INTO records (user_id, date, course_id, start_time, end_time, duration, status, package_id, consumed_hours, note)
       VALUES (?, ?, ?, ?, ?, ?, 'attended', ?, 1, '历史回填')`
    )
    await env.DB.batch(dates.map(dt =>
      stmt.bind(data.uid, dt, course.id, startTime, endTime, (startTime && endTime) ? duration : null, pid)
    ))
    // 期初已用扣掉已展开节数（排不下的余量留在期初已用）
    await env.DB.prepare('UPDATE course_packages SET opening_used = ? WHERE id = ?')
      .bind(Math.max(0, opening - dates.length), pid).run()
  }

  return json({ ok: true, created: dates.length, remaining: Math.max(0, Math.floor(opening - dates.length)) })
}

// ---- 日期工具（统一用 UTC，避免运行环境时区导致偏移）----
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
function fmtYmd(dt) {
  return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0')
}
function addDays(dt, n) { const x = new Date(dt); x.setUTCDate(x.getUTCDate() + n); return x }
function isoWeekday(dt) { const w = dt.getUTCDay(); return w === 0 ? 7 : w }
function addMinutes(hhmm, min) {
  const [h, m] = hhmm.split(':').map(Number)
  const t = ((h * 60 + m + min) % 1440 + 1440) % 1440
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0')
}
