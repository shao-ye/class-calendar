// 课程相关的数据转换工具

// 数据库行 → 前端课程结构
export function toCourse(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    defaultStart: row.default_start,
    defaultDuration: row.default_duration,
    weekdays: row.weekdays ? row.weekdays.split(',').map(Number) : [],
    skipHoliday: !!row.skip_holiday,
    trackHours: !!row.track_hours
  }
}

// 上课星期数组 → 存储字符串 "2,4"（空数组存 null）
export function weekdaysToStr(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  return arr.filter(n => n >= 1 && n <= 7).sort((a, b) => a - b).join(',')
}
