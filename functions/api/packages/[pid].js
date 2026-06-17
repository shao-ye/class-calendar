import { json, readJson } from '../../utils/http.js'
import { ownedPackage, usedHours } from '../../utils/package.js'

// PUT /api/packages/:pid —— 更新课时包（总课时/已上课时/日期/金额/状态）
export async function onRequestPut({ env, data, request, params }) {
  const pid = Number(params.pid)
  const pkg = await ownedPackage(env, pid, data.uid)
  if (!pkg) return json({ error: '课时包不存在' }, 404)

  const b = await readJson(request)
  const total = (b.total != null && Number(b.total) > 0) ? Number(b.total) : pkg.total_hours

  // 前端传的“已上课时”是总已用；扣掉记录消耗后回写期初已用（当前无记录时即等于已上）
  let openingUsed = pkg.opening_used
  if (b.used != null) {
    const consumed = (await usedHours(env, pkg)) - (pkg.opening_used || 0)
    openingUsed = Math.max(0, Number(b.used) - consumed)
  }
  const status = b.status || pkg.status
  const date = b.purchaseDate !== undefined ? b.purchaseDate : pkg.purchase_date
  const amount = b.amount !== undefined ? (b.amount != null ? Number(b.amount) : null) : pkg.amount

  await env.DB.prepare(
    `UPDATE course_packages SET total_hours = ?, opening_used = ?, purchase_date = ?, amount = ?, status = ? WHERE id = ?`
  ).bind(total, openingUsed, date, amount, status, pid).run()
  return json({ ok: true })
}

// DELETE /api/packages/:pid —— 删除课时包（关联记录的 package_id 置空）
export async function onRequestDelete({ env, data, params }) {
  const pid = Number(params.pid)
  const pkg = await ownedPackage(env, pid, data.uid)
  if (!pkg) return json({ error: '课时包不存在' }, 404)
  await env.DB.prepare('UPDATE records SET package_id = NULL WHERE package_id = ?').bind(pid).run()
  await env.DB.prepare('DELETE FROM course_packages WHERE id = ?').bind(pid).run()
  return json({ ok: true })
}
