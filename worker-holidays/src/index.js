// 独立 Worker：定时把法定假日数据同步进 D1（Pages Functions 不支持 Cron，故单列）
// 数据源默认 holiday-cn 的 CDN 镜像，可用 HOLIDAY_API_URL 覆盖（{year} 占位）

const DEFAULT_URL = 'https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/{year}.json'

export default {
  // 定时触发
  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncHolidays(env))
  },
  // 手动触发（需 ?key= 匹配 SYNC_KEY），用于验证
  async fetch(req, env) {
    const url = new URL(req.url)
    if (!env.SYNC_KEY || url.searchParams.get('key') !== env.SYNC_KEY) {
      return new Response('forbidden', { status: 403 })
    }
    const count = await syncHolidays(env)
    return new Response(JSON.stringify({ ok: true, count }), { headers: { 'Content-Type': 'application/json' } })
  }
}

// 同步当年与次年的假日，幂等 upsert
async function syncHolidays(env) {
  const now = new Date().getFullYear()
  const tmpl = env.HOLIDAY_API_URL || DEFAULT_URL
  let total = 0
  for (const y of [now, now + 1]) {
    try {
      const r = await fetch(tmpl.replace('{year}', y), { headers: { 'User-Agent': 'class-calendar' } })
      if (!r.ok) continue
      const data = await r.json()
      const days = data.days || []
      if (!days.length) continue
      const stmts = days.map(d => env.DB
        .prepare('INSERT OR REPLACE INTO holidays (date, name, is_workday) VALUES (?, ?, ?)')
        .bind(d.date, d.name, d.isOffDay ? 0 : 1))
      await env.DB.batch(stmts)
      total += stmts.length
    } catch (e) { /* 单年失败不影响其它年 */ }
  }
  return total
}
