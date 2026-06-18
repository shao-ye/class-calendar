<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'

const STATUS = { attended: '到课', leave: '请假', reschedule: '调课' }
const courses = ref([])
const courseMap = computed(() => Object.fromEntries(courses.value.map(c => [c.id, c])))
const records = ref([])
const range = ref('month')         // week | month
const pkgPrice = ref({})           // 课时包 id → 平均单价(元/课时)
const purchased = ref(0)           // 累计已购买课时包金额(元，不分周月)
const today = new Date()

onMounted(load)
async function load() {
  courses.value = await api('/api/courses')
  const m = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0')
  records.value = await api('/api/records?month=' + m)
  await loadPackagesInfo()
}

// 本周日期集合（周一起始）
const weekSet = computed(() => {
  const base = new Date(today); let wd = base.getDay(); wd = wd === 0 ? 7 : wd
  base.setDate(base.getDate() - (wd - 1))
  const s = new Set()
  for (let i = 0; i < 7; i++) { const d = new Date(base); d.setDate(base.getDate() + i); s.add(ymd(d)) }
  return s
})
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }

const filtered = computed(() => range.value === 'week' ? records.value.filter(r => weekSet.value.has(r.date)) : records.value)
const attended = computed(() => filtered.value.filter(r => r.status === 'attended'))

// 汇总卡片
const days = computed(() => new Set(attended.value.map(r => r.date)).size)
const sessions = computed(() => attended.value.length)
const totalHours = computed(() => {
  const min = attended.value.reduce((s, r) => s + (r.duration || 0), 0)
  return (min / 60).toFixed(1)
})

// 各课程次数
const courseCounts = computed(() => {
  const m = {}
  for (const r of attended.value) m[r.courseId] = (m[r.courseId] || 0) + 1
  const rows = Object.entries(m).map(([id, n]) => ({ course: courseMap.value[id], n })).filter(r => r.course)
  rows.sort((a, b) => b.n - a.n)
  return rows
})
const maxCount = computed(() => Math.max(1, ...courseCounts.value.map(r => r.n)))

// 出勤
const attendance = computed(() => {
  const total = filtered.value.length || 1
  const c = { attended: 0, leave: 0, reschedule: 0 }
  for (const r of filtered.value) c[r.status] = (c[r.status] || 0) + 1
  return Object.entries(c).map(([k, v]) => ({ key: k, label: STATUS[k], pct: Math.round(v / total * 100), color: k === 'attended' ? '#1aa463' : k === 'leave' ? '#e8694a' : '#d99214' }))
})

// 拉取课时包信息：构建「课时包 id → 平均单价」映射，并汇总累计已购买金额
async function loadPackagesInfo() {
  const price = {}; let bought = 0
  for (const c of courses.value.filter(c => c.billMode === 'package')) {
    const pkgs = await api('/api/courses/' + c.id + '/packages')
    for (const p of pkgs) {
      if (p.amount != null && p.total) price[p.id] = p.amount / p.total   // 平均单价 = 金额 ÷ 总课时
      bought += p.amount || 0
    }
  }
  pkgPrice.value = price; purchased.value = bought
}

// 区间实际花费（按到课记录统一折算）：
//   单节付费 → 本节 fee；课时包 → 本节扣课时 × 该包平均单价
const periodSpend = computed(() => {
  let total = 0; const byCourse = {}
  for (const r of attended.value) {
    const c = courseMap.value[r.courseId]
    if (!c) continue
    let cost = 0
    if (c.billMode === 'per_session') cost = r.fee != null ? r.fee : 0
    else if (c.billMode === 'package' && r.packageId) cost = (r.consumedHours || 0) * (pkgPrice.value[r.packageId] || 0)
    if (cost > 0) { total += cost; byCourse[r.courseId] = (byCourse[r.courseId] || 0) + cost }
  }
  const rows = Object.entries(byCourse)
    .map(([id, amt]) => ({ course: courseMap.value[id], amt: Math.round(amt) }))
    .filter(r => r.course).sort((a, b) => b.amt - a.amt)
  return { total: Math.round(total), rows }
})
const maxSpend = computed(() => Math.max(1, ...periodSpend.value.rows.map(r => r.amt)))
</script>

<template>
  <div class="wrap">
    <div class="topbar"><div class="title">统计分析</div><div class="sub">看看上课规律</div></div>

    <div class="range">
      <button :class="{ on: range === 'week' }" @click="range = 'week'">本周</button>
      <button :class="{ on: range === 'month' }" @click="range = 'month'">本月</button>
    </div>

    <div class="cards">
      <div class="card"><div class="n">{{ days }}</div><div class="l">上课天数</div></div>
      <div class="card"><div class="n">{{ sessions }}</div><div class="l">上课节数</div></div>
      <div class="card"><div class="n">{{ totalHours }}h</div><div class="l">累计时长</div></div>
    </div>

    <div class="section">
      <h3>各课程次数</h3>
      <div v-if="!courseCounts.length" class="empty">本{{ range === 'week' ? '周' : '月' }}还没有到课记录</div>
      <div v-for="r in courseCounts" :key="r.course.id" class="bar-row">
        <div class="name">{{ r.course.name }}</div>
        <div class="track"><div class="fill" :style="{ width: Math.round(r.n / maxCount * 100) + '%', background: r.course.color }">{{ r.n }}次</div></div>
      </div>
    </div>

    <div class="section">
      <h3>出勤情况</h3>
      <div v-for="a in attendance" :key="a.key" class="bar-row">
        <div class="name">{{ a.label }}</div>
        <div class="track"><div class="fill" :style="{ width: a.pct + '%', background: a.color }">{{ a.pct }}%</div></div>
      </div>
    </div>

    <div class="section">
      <h3>花费统计 <span class="hint">· 本{{ range === 'week' ? '周' : '月' }}实际消费</span></h3>
      <div class="cards" style="margin: 0 0 14px;">
        <div class="card"><div class="n sm">{{ periodSpend.total }}</div><div class="l">本{{ range === 'week' ? '周' : '月' }}花费(元)</div></div>
        <div class="card"><div class="n sm">{{ purchased }}</div><div class="l">累计已购课包(元)</div></div>
        <div class="card"><div class="n">{{ periodSpend.rows.length }}</div><div class="l">产生花费学科</div></div>
      </div>
      <div v-if="!periodSpend.rows.length" class="empty">本{{ range === 'week' ? '周' : '月' }}还没有产生花费的到课记录</div>
      <div v-for="r in periodSpend.rows" :key="r.course.id" class="bar-row">
        <div class="name">{{ r.course.name }}</div>
        <div class="track"><div class="fill" :style="{ width: Math.round(r.amt / maxSpend * 100) + '%', background: r.course.color }">{{ r.amt }}元</div></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { min-height: 100vh; padding-bottom: 80px; }
.topbar { background: var(--card); padding: 14px 16px; border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 10; }
.title { font-size: 18px; font-weight: 700; }
.sub { font-size: 12px; color: var(--text-sub); }
.range { display: flex; gap: 8px; margin: 12px 12px 0; }
.range button { flex: 1; padding: 9px; border-radius: 10px; background: var(--card); font-size: 13px; font-weight: 600; color: var(--text-sub); box-shadow: 0 1px 4px rgba(0,0,0,.06); border: none; }
.range button.on { background: var(--primary); color: #fff; }
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px; }
.card { background: var(--card); border-radius: 14px; padding: 14px 8px; text-align: center; box-shadow: var(--shadow); }
.card .n { font-size: 22px; font-weight: 800; color: var(--primary); }
.card .n.sm { font-size: 18px; }
.card .l { font-size: 11px; color: var(--text-sub); margin-top: 4px; }
.section { background: var(--card); margin: 12px; border-radius: 16px; padding: 16px; box-shadow: var(--shadow); }
.section h3 { margin: 0 0 14px; font-size: 15px; }
.hint { font-size: 12px; color: var(--text-sub); font-weight: 400; }
.empty { font-size: 13px; color: var(--text-sub); padding: 8px 0; }
.bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.bar-row:last-child { margin-bottom: 0; }
.name { width: 54px; font-size: 12px; font-weight: 600; }
.track { flex: 1; height: 18px; background: var(--bg); border-radius: 9px; overflow: hidden; }
.fill { height: 100%; border-radius: 9px; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px; color: #fff; font-size: 10px; font-weight: 700; min-width: 22px; box-sizing: border-box; }
</style>
