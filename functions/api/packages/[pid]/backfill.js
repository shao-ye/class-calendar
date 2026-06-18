import { json, readJson } from '../../../utils/http.js'
import { ownedPackage } from '../../../utils/package.js'

// POST /api/packages/:pid/backfill —— 把课时包的「期初已上」展开为过往到课记录
//   body: { startDate: 'YYYY-MM-DD' }
//   规则：从起始日向后，按课程「上课星期」依次补 N 条到课记录（N = 期初已用的整数部分，按 1 课时/节），
//        跳过法定假日与已有同课记录；补完把期初已用扣减相应节数（总已用不变），新记录可逐条编辑。
export async function onRequestPost({ env, data, request, params }) {
  const pid = Number(params.pid)
  const pkg = await ownedPackage(env, pid, data.uid)
  if (!pkg) return json({ error: '课时包不存在' }, 404)

  const course = await env.DB.prepare(
    'SELECT id, weekdays, skip_holiday, default_start, default_duration FROM courses WHERE id = ?'
  ).bind(pkg.course_id).first()
  if (!course) return json({ error: '课程不存在' }, 404)

  // 待回填节数 = 期初已用的整数部分（按 1 课时/节）
  const opening = pkg.opening_used || 0
  const count = Math.floor(opening)
  if (count <= 0) return json({ error: '没有可回填的期初已上课时' }, 400)

  const weekdays = course.weekdays ? course.weekdays.split(',').map(Number) : []
  if (!weekdays.length) return json({ error: '请先为课程设置上课星期，才能按规则回填' }, 400)

  const b = await readJson(request)
  if (!b.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.startDate)) return json({ error: '请选择起始日期' }, 400)
  // 回填上限：默认到客户端本地"今天"，缺省回落服务器 UTC 今天。历史回填不生成未来日期。
  const maxDate = (b.maxDate && /^\d{4}-\d{2}-\d{2}$/.test(b.maxDate)) ? b.maxDate : fmtYmd(new Date())

  // 法定假日集合（仅放假日，调休补班日不算）
  const holSet = new Set()
  if (course.skip_holiday) {
    const hs = (await env.DB.prepare('SELECT date FROM holidays WHERE is_workday = 0').all()).results
    for (const h of hs) holSet.add(h.date)
  }

  // 已有该课程的记录日期，避免回填出重复记录
  const existing = new Set(
    (await env.DB.prepare('SELECT date FROM records WHERE user_id = ? AND course_id = ?').bind(data.uid, course.id).all())
      .results.map(r => r.date)
  )

  // 时间段（沿用课程默认值）
  const startTime = course.default_start || null
  const duration = course.default_duration || 60
  const endTime = startTime ? addMinutes(startTime, duration) : null

  // 从起始日向后逐天扫描，选出 count 个符合上课星期的日期（只排到今天为止，不生成未来记录）
  const dates = []
  let d = parseYmd(b.startDate)
  let guard = 0
  while (dates.length < count && guard < 3000) {
    guard++
    const key = fmtYmd(d)
    if (key > maxDate) break                // 到达今天之后即停止，未来不属于历史回填
    const wd = isoWeekday(d)                // 1=周一…7=周日
    if (weekdays.includes(wd) && !holSet.has(key) && !existing.has(key)) dates.push(key)
    d = addDays(d, 1)
  }
  if (!dates.length) return json({ error: '从该起始日到今天之间，按规则没有可回填的历史日期' }, 400)

  // 批量插入到课记录（绑定本包，扣 1 课时，备注标记为历史回填）
  const stmt = env.DB.prepare(
    `INSERT INTO records (user_id, date, course_id, start_time, end_time, duration, status, package_id, consumed_hours, note)
     VALUES (?, ?, ?, ?, ?, ?, 'attended', ?, 1, ?)`
  )
  const batch = dates.map(dt =>
    stmt.bind(data.uid, dt, course.id, startTime, endTime, (startTime && endTime) ? duration : null, pid, '历史回填')
  )
  await env.DB.batch(batch)

  // 期初已用扣掉已展开的节数（保持「总已用」不变；排不下的余量留在期初已用）
  const remainOpening = Math.max(0, opening - dates.length)
  await env.DB.prepare('UPDATE course_packages SET opening_used = ? WHERE id = ?').bind(remainOpening, pid).run()

  return json({ ok: true, created: dates.length, remaining: Math.floor(remainOpening) })
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
