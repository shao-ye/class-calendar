// 课时包工具：校验归属、计算已用/剩余

// 计算某课时包的已用课时 = 期初已用 + 关联的到课记录消耗
export async function usedHours(env, pkg) {
  const row = await env.DB
    .prepare("SELECT COALESCE(SUM(consumed_hours), 0) AS c FROM records WHERE package_id = ? AND status = 'attended'")
    .bind(pkg.id).first()
  return (pkg.opening_used || 0) + (row.c || 0)
}

// 数据库行 → 前端课时包结构（含已用/剩余）
export async function toPackage(env, pkg) {
  const used = await usedHours(env, pkg)
  return {
    id: pkg.id,
    total: pkg.total_hours,
    used,
    remaining: pkg.total_hours - used,
    openingUsed: pkg.opening_used,
    date: pkg.purchase_date,
    amount: pkg.amount,
    status: pkg.status
  }
}

// 校验课时包归属当前用户，返回包行或 null
export async function ownedPackage(env, pid, uid) {
  return env.DB
    .prepare('SELECT p.* FROM course_packages p JOIN courses c ON c.id = p.course_id WHERE p.id = ? AND c.user_id = ?')
    .bind(pid, uid).first()
}
