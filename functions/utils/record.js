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

// 计算某课程当前生效课时包 id（无则 null）
export async function activePackageId(env, courseId) {
  const ap = await env.DB
    .prepare("SELECT id FROM course_packages WHERE course_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1")
    .bind(courseId).first()
  return ap ? ap.id : null
}
