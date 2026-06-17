import { json, readJson } from '../../utils/http.js'

// 默认数据源：开源维护的中国节假日数据（含调休补班）。可用 HOLIDAY_API_URL 覆盖，{year} 为占位。
const DEFAULT_URL = 'https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/{year}.json'

// POST /api/holidays/sync —— 从外部接口拉取并 upsert 到 D1（前端不直连外部）
// body: { year?: number }；不传则同步当年与次年
export async function onRequestPost({ env, request }) {
  const b = await readJson(request)
  const now = new Date().getFullYear()
  const years = b.year ? [b.year] : [now, now + 1]
  const tmpl = env.HOLIDAY_API_URL || DEFAULT_URL

  let total = 0
  const detail = []
  for (const y of years) {
    const u = tmpl.replace('{year}', y)
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'class-calendar' } })
      if (!r.ok) { detail.push({ year: y, ok: false, status: r.status }); continue }
      const data = await r.json()
      const days = data.days || []
      if (!days.length) { detail.push({ year: y, ok: false, reason: 'empty' }); continue }
      // isOffDay=true 为放假日(is_workday=0)，false 为调休补班(is_workday=1)
      const stmts = days.map(d => env.DB
        .prepare('INSERT OR REPLACE INTO holidays (date, name, is_workday) VALUES (?, ?, ?)')
        .bind(d.date, d.name, d.isOffDay ? 0 : 1))
      await env.DB.batch(stmts)
      total += stmts.length
      detail.push({ year: y, ok: true, count: stmts.length })
    } catch (e) {
      detail.push({ year: y, ok: false, reason: String(e) })
    }
  }
  return json({ ok: true, count: total, detail })
}
