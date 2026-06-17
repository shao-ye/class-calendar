import { json } from '../utils/http.js'

// GET /api/holidays?year=YYYY —— 读取某年法定假日（前端排课用，读 D1）
export async function onRequestGet({ env, request }) {
  const url = new URL(request.url)
  const year = url.searchParams.get('year') || String(new Date().getFullYear())
  const { results } = await env.DB
    .prepare('SELECT date, name, is_workday FROM holidays WHERE date LIKE ? ORDER BY date')
    .bind(year + '-%').all()
  return json(results.map(r => ({ date: r.date, name: r.name, isWorkday: !!r.is_workday })))
}
