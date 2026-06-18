// 上课记录工具：行转换、时长计算

// 数据库行 → 前端记录结构
export function toRecord(row) {
  return {
    id: row.id,
    date: row.date,
    courseId: row.course_id,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    status: row.status,
    packageId: row.package_id,
    consumedHours: row.consumed_hours,
    fee: row.fee != null ? row.fee : null,
    note: row.note
  }
}

// 由开始/结束时间算时长(分钟)，无法计算时取 fallback
export function calcDuration(start, end, fallback) {
  if (start && end) {
    const [a, b] = start.split(':').map(Number)
    const [c, d] = end.split(':').map(Number)
    const m = (c * 60 + d) - (a * 60 + b)
    if (m > 0) return m
  }
  return fallback != null ? fallback : null
}

// 计算本节花费：仅单节付费课且到课时计费；传入值优先，否则回落课程单节默认价；其余情形不计费
//   course: { bill_mode, default_fee }，status: 记录状态，inputFee: 客户端传入的本节价格
export function resolveFee(course, status, inputFee) {
  if (course.bill_mode !== 'per_session' || status !== 'attended') return null
  if (inputFee != null && inputFee !== '') return Number(inputFee)
  return course.default_fee != null ? Number(course.default_fee) : null
}

// 计算某条记录的本节花费（用于详情展示）：
//   单节付费 → 实际 fee；课时包 → 本节扣课时 × 该包平均单价(金额÷总课时)；其余 → null
export async function recordCost(env, rec) {
  if (rec.fee != null) return rec.fee
  if (rec.packageId && rec.consumedHours) {
    const pk = await env.DB.prepare('SELECT amount, total_hours FROM course_packages WHERE id = ?').bind(rec.packageId).first()
    if (pk && pk.amount != null && pk.total_hours) return Math.round(rec.consumedHours * pk.amount / pk.total_hours)
  }
  return null
}

// 计算课时包记录的「第几节 / 共几节」：
//   第几节 = 期初已用 + 截至本节(含)的累计扣课时；共几节 = 课包总课时。非课包记录返回 null。
export async function recordSeq(env, rec) {
  if (!rec.packageId) return null
  const pk = await env.DB.prepare('SELECT opening_used, total_hours FROM course_packages WHERE id = ?').bind(rec.packageId).first()
  if (!pk) return null
  // 同包到课记录按 日期、id 排序，累计到本节为止的扣课时
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(consumed_hours), 0) AS c FROM records
     WHERE package_id = ? AND status = 'attended' AND (date < ? OR (date = ? AND id <= ?))`
  ).bind(rec.packageId, rec.date, rec.date, rec.id).first()
  return { seq: (pk.opening_used || 0) + (row.c || 0), total: pk.total_hours }
}

// 计算某课程当前生效课时包 id（无则 null）
export async function activePackageId(env, courseId) {
  const ap = await env.DB
    .prepare("SELECT id FROM course_packages WHERE course_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1")
    .bind(courseId).first()
  return ap ? ap.id : null
}
