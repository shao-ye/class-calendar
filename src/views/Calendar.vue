<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'

const WD = ['一', '二', '三', '四', '五', '六', '日']
const STATUS = { attended: '到课', leave: '请假', reschedule: '调课' }

const courses = ref([])
const courseMap = computed(() => Object.fromEntries(courses.value.map(c => [c.id, c])))

const today = new Date()
const todayKey = ymd(today)
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())   // 0-based
const view = ref('month')                  // month | week
const records = ref([])
const todayRecs = ref([])
const toastMsg = ref('')

// 当日抽屉与记录表单
const sheetOpen = ref(false)
const selDate = ref('')
const formOpen = ref(false)
const editingId = ref(null)
const rform = ref(null)
const courseQuery = ref('')
const showDrop = ref(false)
const editingPhotos = ref([])   // 编辑时的已存照片 id
const pendingFiles = ref([])    // 待上传照片 {blob,url}

// ---------- 工具 ----------
function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
function addMin(start, min) {
  const [h, m] = start.split(':').map(Number)
  const t = ((h * 60 + m + min) % 1440 + 1440) % 1440
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0')
}
function durMin(s, e) {
  if (!s || !e) return 0
  const [a, b] = s.split(':').map(Number), [c, d] = e.split(':').map(Number)
  return (c * 60 + d) - (a * 60 + b)
}

// ---------- 数据加载 ----------
async function loadCourses() {
  try { courses.value = await api('/api/courses') } catch (e) { toast(e.message) }
}
async function loadMonth() {
  const m = viewYear.value + '-' + String(viewMonth.value + 1).padStart(2, '0')
  try { records.value = await api('/api/records?month=' + m) } catch (e) { toast(e.message) }
}
async function loadToday() {
  try { todayRecs.value = await api('/api/records?date=' + todayKey) } catch (e) { toast(e.message) }
}
onMounted(async () => {
  await loadCourses(); await loadMonth(); await loadToday()
  loadHolidays(today.getFullYear()); loadHolidays(today.getFullYear() + 1)
})

// ---------- 月视图网格（周一起始） ----------
const cells = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1)
  let start = first.getDay(); start = start === 0 ? 7 : start
  const days = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
  const arr = []
  for (let i = 1; i < start; i++) arr.push(null)
  for (let d = 1; d <= days; d++) arr.push(d)
  return arr
})
const recordsByDate = computed(() => {
  const m = {}
  for (const r of records.value) (m[r.date] = m[r.date] || []).push(r)
  return m
})
const monthLabel = computed(() => viewYear.value + '年' + (viewMonth.value + 1) + '月')
function cellKey(d) { return ymd(new Date(viewYear.value, viewMonth.value, d)) }
function changeMonth(delta) {
  let mm = viewMonth.value + delta, yy = viewYear.value
  if (mm < 0) { mm = 11; yy-- } if (mm > 11) { mm = 0; yy++ }
  viewMonth.value = mm; viewYear.value = yy
  loadMonth(); loadHolidays(yy)
}
function goToday() { viewYear.value = today.getFullYear(); viewMonth.value = today.getMonth(); loadMonth() }

// ---------- 法定假日 + 自动排课（计划课投影） ----------
const holidays = ref({})
const loadedYears = new Set()
async function loadHolidays(year) {
  if (loadedYears.has(year)) return
  loadedYears.add(year)
  try { const list = await api('/api/holidays?year=' + year); for (const h of list) holidays.value[h.date] = h } catch {}
}
// 是否放假日（调休补班日不算）
function isOffDay(key) { const h = holidays.value[key]; return !!(h && !h.isWorkday) }

// 从今天向后投影各课程的计划上课日：统计课时的课排“剩余课时”节，其余排固定天数；按需跳过假日
const plannedByDate = computed(() => {
  const map = {}
  for (const c of courses.value) {
    if (!c.weekdays || !c.weekdays.length) continue
    let cnt = c.trackHours ? Math.floor(c.activePackage?.remaining || 0) : 30
    if (cnt <= 0) continue
    const d = new Date(today); let guard = 0
    while (cnt > 0 && guard < 500) {
      guard++
      const wd = d.getDay() === 0 ? 7 : d.getDay()
      const key = ymd(d)
      if (c.weekdays.includes(wd) && !(c.skipHoliday && isOffDay(key))) {
        // 当天若已有该课程的真实记录则不再显示计划（月/周视图均按日期查表）
        if (!(recordsByDate.value[key] || []).some(r => r.courseId === c.id)) {
          (map[key] = map[key] || []).push(c.id)
        }
        cnt--
      }
      d.setDate(d.getDate() + 1)
    }
  }
  return map
})
// 某天展示项：已记录(实线) + 计划课(虚线)
function cellItems(key) {
  const items = []
  for (const r of (recordsByDate.value[key] || [])) { const c = courseMap.value[r.courseId]; items.push({ color: c?.color || '#999', name: c?.name || '课', plan: false }) }
  for (const cid of (plannedByDate.value[key] || [])) { const c = courseMap.value[cid]; items.push({ color: c?.color, name: c?.name, plan: true }) }
  return items
}

// 某天的明细项（已记录+计划课，含时间），供周视图展示
function dayItemsDetailed(key) {
  const items = []
  for (const r of (recordsByDate.value[key] || [])) {
    const c = courseMap.value[r.courseId]
    items.push({ color: c?.color, name: c?.name, time: r.startTime ? (r.startTime + (r.endTime ? '-' + r.endTime : '')) : '', plan: false })
  }
  for (const cid of (plannedByDate.value[key] || [])) {
    const c = courseMap.value[cid]
    items.push({ color: c?.color, name: c?.name, time: c?.defaultStart ? (c.defaultStart + '-' + addMin(c.defaultStart, c.defaultDuration || 60)) : '', plan: true })
  }
  return items
}

// 当日的计划课（尚未记录的预排课程），供抽屉展示与“确认到课”
const dayPlanned = computed(() => (plannedByDate.value[selDate.value] || []).map(id => courseMap.value[id]).filter(Boolean))
const todayPlanned = computed(() => (plannedByDate.value[todayKey] || []).map(id => courseMap.value[id]).filter(Boolean))

// 一键确认到课：把计划课转成真实记录（套用课程默认时间，到课扣课时）
async function confirmPlanned(c) {
  const payload = {
    date: selDate.value, courseId: c.id,
    startTime: c.defaultStart || null,
    endTime: c.defaultStart ? addMin(c.defaultStart, c.defaultDuration || 60) : null,
    status: 'attended', consumedHours: 1, note: null
  }
  try {
    await api('/api/records', { method: 'POST', body: payload })
    await loadMonth(); await loadDay()
    if (selDate.value === todayKey) await loadToday()
    toast('已确认到课')
  }
  catch (e) { toast(e.message) }
}
// 以计划课为基础打开编辑表单（可改时间/状态/备注后保存）
function planToForm(c) { openAdd(); pickCourse(c) }

// ---------- 周视图（可前后翻周，周一起始） ----------
function mondayOf(date) { const b = new Date(date); let wd = b.getDay(); wd = wd === 0 ? 7 : wd; b.setDate(b.getDate() - (wd - 1)); b.setHours(0, 0, 0, 0); return b }
const weekStart = ref(mondayOf(today))
const weekDays = computed(() => { const arr = []; for (let i = 0; i < 7; i++) { const d = new Date(weekStart.value); d.setDate(weekStart.value.getDate() + i); arr.push(d) } return arr })
const weekLabel = computed(() => { const s = weekStart.value, e = new Date(weekStart.value); e.setDate(s.getDate() + 6); return (s.getMonth() + 1) + '月' + s.getDate() + '日 - ' + (e.getMonth() + 1) + '月' + e.getDate() + '日' })
// 按当前周的日期区间加载记录
async function loadWeek() {
  try { records.value = await api('/api/records?from=' + ymd(weekDays.value[0]) + '&to=' + ymd(weekDays.value[6])) } catch (e) { toast(e.message) }
}
function changeWeek(delta) { const d = new Date(weekStart.value); d.setDate(d.getDate() + delta * 7); weekStart.value = d; loadWeek() }
function thisWeek() { weekStart.value = mondayOf(today); loadWeek() }
// 切换月/周视图，并按需加载对应数据
function setView(v) { view.value = v; if (v === 'week') loadWeek(); else loadMonth() }

// ---------- 当日抽屉 ----------
const dayRecs = ref([])   // 当日记录（带照片 id 列表）
async function loadDay() { try { dayRecs.value = await api('/api/records?date=' + selDate.value) } catch (e) { toast(e.message) } }
async function openDay(key) { selDate.value = key; formOpen.value = false; sheetOpen.value = true; await loadDay() }
function closeSheet() { sheetOpen.value = false; formOpen.value = false }
function dayTitle(key) {
  if (!key) return ''
  const d = new Date(key)
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + WD[(d.getDay() === 0 ? 7 : d.getDay()) - 1]
}

// ---------- 记录表单 ----------
function openAdd() {
  editingId.value = null
  rform.value = { courseId: null, startTime: '', endTime: '', status: 'attended', consumedHours: 1, fee: '', note: '' }
  courseQuery.value = ''
  editingPhotos.value = []
  pendingFiles.value = []
  formOpen.value = true
}
function openEdit(r) {
  editingId.value = r.id
  rform.value = { courseId: r.courseId, startTime: r.startTime || '', endTime: r.endTime || '', status: r.status, consumedHours: r.consumedHours != null ? r.consumedHours : 1, fee: r.fee != null ? r.fee : '', note: r.note || '' }
  courseQuery.value = courseMap.value[r.courseId] ? courseMap.value[r.courseId].name : ''
  editingPhotos.value = [...(r.photos || [])]
  pendingFiles.value = []
  formOpen.value = true
}
const selectedCourse = computed(() => courseMap.value[rform.value?.courseId])
const filteredCourses = computed(() => {
  const q = courseQuery.value.trim()
  return courses.value.filter(c => c.name.includes(q))
})
const showCreate = computed(() => {
  const q = courseQuery.value.trim()
  return q && !courses.value.some(c => c.name === q)
})
function pickCourse(c) {
  rform.value.courseId = c.id
  courseQuery.value = c.name
  showDrop.value = false
  if (c.defaultStart) { rform.value.startTime = c.defaultStart; rform.value.endTime = addMin(c.defaultStart, c.defaultDuration || 60) }
  // 单节付费：自动带出课程单节默认价（可改）
  if (c.billMode === 'per_session') rform.value.fee = c.defaultFee != null ? c.defaultFee : ''
}
async function createCourse(name) {
  try {
    const r = await api('/api/courses', { method: 'POST', body: { name } })
    await loadCourses()
    pickCourse(courseMap.value[r.id])
    toast('已创建课程「' + name + '」')
  } catch (e) { toast(e.message) }
}
async function saveRecord() {
  const f = rform.value
  if (!f.courseId) { toast('请选择或创建课程'); return }
  const payload = { date: selDate.value, courseId: f.courseId, startTime: f.startTime || null, endTime: f.endTime || null, status: f.status, consumedHours: f.consumedHours, fee: f.fee === '' ? null : Number(f.fee), note: f.note || null }
  try {
    let recordId = editingId.value
    if (recordId) await api('/api/records/' + recordId, { method: 'PUT', body: payload })
    else { const r = await api('/api/records', { method: 'POST', body: payload }); recordId = r.id }
    // 上传待传照片
    for (const p of pendingFiles.value) await uploadPhoto(recordId, p.blob)
    pendingFiles.value = []
    formOpen.value = false
    await loadMonth(); await loadDay()
    if (selDate.value === todayKey) await loadToday()
    toast('已保存')
  } catch (e) { toast(e.message) }
}
async function deleteRecord(r) {
  if (!confirm('删除这条记录？')) return
  try {
    await api('/api/records/' + r.id, { method: 'DELETE' })
    await loadMonth(); await loadDay()
    if (selDate.value === todayKey) await loadToday()
    toast('已删除')
  } catch (e) { toast(e.message) }
}

// ---------- 照片 ----------
// 选择文件 → 压缩 → 放入待上传
function onPickFiles(e) {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  files.forEach(async (file) => {
    const blob = await compressImage(file)
    pendingFiles.value.push({ blob, url: URL.createObjectURL(blob) })
  })
}
function removePending(i) { pendingFiles.value.splice(i, 1) }
async function deleteExistingPhoto(pid) {
  if (!confirm('删除这张照片？')) return
  try { await api('/api/photos/' + pid, { method: 'DELETE' }); editingPhotos.value = editingPhotos.value.filter(x => x !== pid) } catch (e) { toast(e.message) }
}
async function uploadPhoto(recordId, blob) {
  const fd = new FormData()
  fd.append('recordId', recordId)
  fd.append('file', blob, 'photo.jpg')
  const r = await fetch('/api/photos', { method: 'POST', body: fd, credentials: 'same-origin' })
  if (!r.ok) throw new Error('照片上传失败')
}
// 前端压缩：最长边 1280，JPEG 0.8
function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const max = 1280
      let w = img.width, h = img.height
      if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s) }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h
      cv.getContext('2d').drawImage(img, 0, 0, w, h)
      cv.toBlob(b => { URL.revokeObjectURL(url); resolve(b || file) }, 'image/jpeg', 0.8)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

let toastTimer
function toast(msg) { toastMsg.value = msg; clearTimeout(toastTimer); toastTimer = setTimeout(() => (toastMsg.value = ''), 1800) }
</script>

<template>
  <div class="wrap">
    <div class="topbar">
      <div>
        <div class="title">课程日历</div>
        <div class="sub">宝贝的成长记录</div>
      </div>
      <div class="seg">
        <button :class="{ on: view === 'month' }" @click="setView('month')">月</button>
        <button :class="{ on: view === 'week' }" @click="setView('week')">周</button>
      </div>
    </div>

    <!-- 月视图 -->
    <template v-if="view === 'month'">
      <div class="calhead">
        <div class="mon">{{ monthLabel }}</div>
        <div class="nav">
          <button @click="changeMonth(-1)">‹</button>
          <button class="todaybtn" @click="goToday">今天</button>
          <button @click="changeMonth(1)">›</button>
        </div>
      </div>
      <div class="weekrow"><span v-for="(n, i) in WD" :key="i" :class="{ we: i >= 5 }">{{ n }}</span></div>
      <div class="grid">
        <template v-for="(d, i) in cells" :key="i">
          <div v-if="d === null" class="cell out"></div>
          <div v-else class="cell" :class="{ today: cellKey(d) === todayKey, holiday: isOffDay(cellKey(d)) }" @click="openDay(cellKey(d))">
            <div class="dnum">{{ d }}</div>
            <div v-if="isOffDay(cellKey(d))" class="hol">休</div>
            <div v-for="(it, k) in cellItems(cellKey(d)).slice(0, 2)" :key="k" class="tag" :class="{ plan: it.plan }"
              :style="it.plan ? { color: it.color, borderColor: it.color } : { background: it.color }">{{ it.name }}</div>
            <div v-if="cellItems(cellKey(d)).length > 2" class="more">+{{ cellItems(cellKey(d)).length - 2 }}</div>
          </div>
        </template>
      </div>
      <div class="legend">
        <span><i class="lg-solid"></i>已记录</span>
        <span><i class="lg-dash"></i>计划课（自动预排）</span>
        <span><i class="lg-hol"></i>法定假日</span>
      </div>
    </template>

    <!-- 周视图 -->
    <template v-else>
      <div class="calhead">
        <div class="mon">{{ weekLabel }}</div>
        <div class="nav">
          <button @click="changeWeek(-1)">‹</button>
          <button class="todaybtn" @click="thisWeek">本周</button>
          <button @click="changeWeek(1)">›</button>
        </div>
      </div>
      <div class="weekview">
        <div v-for="(d, i) in weekDays" :key="i" class="wv-day" :class="{ today: ymd(d) === todayKey }" @click="openDay(ymd(d))">
          <div class="wv-d">周{{ WD[i] }} <small>{{ d.getMonth() + 1 }}/{{ d.getDate() }}</small><span v-if="ymd(d) === todayKey" class="wv-today">今天</span><span v-if="isOffDay(ymd(d))" class="wv-hol">休</span></div>
          <div v-if="!dayItemsDetailed(ymd(d)).length" class="wv-empty">— 无安排 —</div>
          <div v-for="(it, k) in dayItemsDetailed(ymd(d))" :key="k" class="wv-item">
            <span class="bar" :style="{ background: it.color }"></span>
            <span class="ct">{{ it.name }}<span v-if="it.plan" class="planmark">计划</span></span>
            <span class="tm">{{ it.time }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- 今日课程默认展示；原有日期点击抽屉逻辑保持不变 -->
    <section class="today-panel">
      <div class="today-panel-head">
        <div>
          <div class="today-panel-title">今日课程</div>
          <div class="today-panel-date">{{ dayTitle(todayKey) }}</div>
        </div>
        <span class="today-panel-count">{{ todayRecs.length + todayPlanned.length }} 节</span>
      </div>

      <div v-for="r in todayRecs" :key="'today-' + r.id" class="rec today-rec">
        <div class="rtop">
          <span class="bar" :style="{ background: courseMap[r.courseId]?.color }"></span>
          <span class="rnm">{{ courseMap[r.courseId]?.name }}</span>
          <span class="st" :class="'st-' + r.status">{{ STATUS[r.status] }}</span>
        </div>
        <div class="rmeta">
          <span v-if="r.startTime">🕒 {{ r.startTime }}-{{ r.endTime }}</span>
          <span v-if="durMin(r.startTime, r.endTime) > 0">{{ durMin(r.startTime, r.endTime) }}分钟</span>
          <span v-if="r.packageId">扣 {{ r.consumedHours }} 课时</span>
          <span v-if="r.fee != null">¥{{ r.fee }}</span>
          <span v-else-if="r.cost != null">约 ¥{{ r.cost }}</span>
        </div>
        <div v-if="r.note" class="rnote">{{ r.note }}</div>
      </div>

      <div v-for="c in todayPlanned" :key="'today-plan-' + c.id" class="rec plan today-rec">
        <div class="rtop">
          <span class="bar" :style="{ background: c.color }"></span>
          <span class="rnm">{{ c.name }}</span>
          <span class="st st-plan">计划课</span>
        </div>
        <div v-if="c.defaultStart" class="rmeta">
          <span>🕒 {{ c.defaultStart }}-{{ addMin(c.defaultStart, c.defaultDuration || 60) }}</span>
        </div>
      </div>

      <div v-if="!todayRecs.length && !todayPlanned.length" class="today-empty">今天还没有课程安排</div>
    </section>

    <!-- 浮动新增（记录今天） -->
    <button class="fab" @click="openDay(todayKey)">＋</button>

    <!-- 当日抽屉 -->
    <div v-if="sheetOpen" class="mask" @click.self="closeSheet">
      <div class="sheet">
        <div class="sheet-head">
          <div class="h">{{ dayTitle(selDate) }}</div>
          <button class="close" @click="closeSheet">✕</button>
        </div>
        <div v-if="!formOpen" class="sheet-body">
          <div v-for="r in dayRecs" :key="r.id" class="rec">
            <div class="rtop">
              <span class="bar" :style="{ background: courseMap[r.courseId]?.color }"></span>
              <span class="rnm">{{ courseMap[r.courseId]?.name }}</span>
              <span class="st" :class="'st-' + r.status">{{ STATUS[r.status] }}</span>
              <span class="rops"><button @click="openEdit(r)">编辑</button><button @click="deleteRecord(r)">删除</button></span>
            </div>
            <div class="rmeta">
              <span v-if="r.startTime">🕐 {{ r.startTime }}-{{ r.endTime }}</span>
              <span v-if="durMin(r.startTime, r.endTime) > 0">{{ durMin(r.startTime, r.endTime) }}分钟</span>
              <span v-if="r.packageId">扣{{ r.consumedHours }}课时</span>
              <span v-if="r.seq != null">第{{ r.seq }}/{{ r.seqTotal }}节</span>
              <span v-if="r.fee != null">💴¥{{ r.fee }}</span>
              <span v-else-if="r.cost != null">💴≈¥{{ r.cost }}</span>
            </div>
            <div v-if="r.note" class="rnote">{{ r.note }}</div>
            <div v-if="r.photos && r.photos.length" class="rphotos">
              <img v-for="pid in r.photos" :key="pid" :src="'/api/photos/' + pid" class="thumb" />
            </div>
          </div>
          <!-- 计划课（自动预排，未记录） -->
          <div v-for="c in dayPlanned" :key="'plan' + c.id" class="rec plan">
            <div class="rtop">
              <span class="bar" :style="{ background: c.color }"></span>
              <span class="rnm">{{ c.name }}</span>
              <span class="st st-plan">计划课</span>
              <span class="rops"><button class="confirm" @click="confirmPlanned(c)">确认到课</button><button @click="planToForm(c)">编辑</button></span>
            </div>
            <div v-if="c.defaultStart" class="rmeta"><span>🕐 {{ c.defaultStart }}-{{ addMin(c.defaultStart, c.defaultDuration || 60) }}</span></div>
          </div>
          <div v-if="!dayRecs.length && !dayPlanned.length" class="empty">这一天还没有记录</div>
          <button class="add" @click="openAdd">＋ 添加一节课</button>
        </div>

        <div v-else class="sheet-body">
          <label>课程</label>
          <div class="combo">
            <input v-model="courseQuery" type="text" placeholder="输入或选择课程，没有会自动创建"
              @focus="showDrop = true" @input="showDrop = true" autocomplete="off" />
            <div v-if="showDrop" class="droplist">
              <div v-for="c in filteredCourses" :key="c.id" class="opt" @click="pickCourse(c)">
                <span class="sw" :style="{ background: c.color }"></span>{{ c.name }}
              </div>
              <div v-if="showCreate" class="opt create" @click="createCourse(courseQuery.trim())">＋ 创建「{{ courseQuery.trim() }}」</div>
            </div>
          </div>
          <label>时间段 <span class="hint">· 选课自动带出，可改</span></label>
          <div class="row"><input v-model="rform.startTime" type="time" /><input v-model="rform.endTime" type="time" /></div>
          <label>状态</label>
          <div class="statuspick">
            <button v-for="(label, key) in STATUS" :key="key" :class="{ on: rform.status === key }" @click="rform.status = key">{{ label }}</button>
          </div>
          <div v-if="selectedCourse?.trackHours && rform.status === 'attended'">
            <label>扣课时</label>
            <div class="step">
              <button @click="rform.consumedHours = Math.max(0.5, rform.consumedHours - 0.5)">−</button>
              <span>{{ rform.consumedHours }}</span>
              <button @click="rform.consumedHours += 0.5">＋</button>
              <span class="hint">课时（请假/调课不扣）</span>
            </div>
          </div>
          <div v-if="selectedCourse?.billMode === 'per_session' && rform.status === 'attended'">
            <label>本节价格 <span class="hint">· 默认带出课程单节价，可改（请假/调课不计费）</span></label>
            <div class="fee-input">
              <span class="yuan">¥</span>
              <input v-model="rform.fee" type="number" min="0" step="1" placeholder="无花费可留空" />
              <span class="unit">元</span>
            </div>
          </div>
          <label>备注</label>
          <textarea v-model="rform.note" rows="3" placeholder="今天学了什么、表现如何…"></textarea>
          <label>照片</label>
          <div class="photo-pick">
            <div v-for="pid in editingPhotos" :key="'e' + pid" class="ph">
              <img :src="'/api/photos/' + pid" />
              <button class="px" @click="deleteExistingPhoto(pid)">×</button>
            </div>
            <div v-for="(p, i) in pendingFiles" :key="'p' + i" class="ph">
              <img :src="p.url" />
              <button class="px" @click="removePending(i)">×</button>
            </div>
            <label class="addph">＋<input type="file" accept="image/*" multiple @change="onPickFiles" hidden /></label>
          </div>
          <div class="actions">
            <button class="ghost" @click="formOpen = false">取消</button>
            <button class="primary" @click="saveRecord">保存</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
  </div>
</template>

<style scoped>
.wrap { min-height: 100vh; padding-bottom: 80px; }
.topbar { background: var(--card); padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 10; }
.title { font-size: 18px; font-weight: 700; }
.sub { font-size: 12px; color: var(--text-sub); }
.seg { display: flex; background: var(--bg); border-radius: 10px; padding: 3px; }
.seg button { padding: 6px 14px; border-radius: 8px; font-size: 13px; color: var(--text-sub); font-weight: 600; background: none; border: none; }
.seg button.on { background: var(--card); color: var(--primary); box-shadow: 0 1px 4px rgba(0,0,0,.08); }
.calhead { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 6px; }
.mon { font-size: 17px; font-weight: 700; }
.nav { display: flex; gap: 8px; align-items: center; }
.nav button { width: 32px; height: 32px; border-radius: 8px; background: var(--card); font-size: 16px; color: var(--text-sub); box-shadow: 0 1px 4px rgba(0,0,0,.06); border: none; }
.todaybtn { font-size: 12px; color: var(--primary); font-weight: 600; background: var(--primary-soft) !important; width: auto !important; padding: 0 10px; }
.weekrow { display: grid; grid-template-columns: repeat(7, 1fr); padding: 6px 8px 0; }
.weekrow span { text-align: center; font-size: 12px; color: var(--text-sub); font-weight: 600; }
.weekrow span.we { color: #f0876b; }
.grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; padding: 6px 8px 12px; }
.cell { position: relative; background: var(--card); border-radius: 10px; min-height: 62px; padding: 5px 4px; }
.cell.out { background: transparent; }
.cell.holiday { background: #fff6f4; }
.cell.holiday.out { background: transparent; }
.hol { position: absolute; top: 4px; left: 4px; font-size: 9px; color: #f0876b; font-weight: 700; }
.dnum { font-size: 12px; font-weight: 600; text-align: center; margin-bottom: 2px; }
.cell.today .dnum { background: var(--primary); color: #fff; border-radius: 50%; width: 20px; height: 20px; line-height: 20px; margin: 0 auto 2px; }
.tag { font-size: 10px; line-height: 1.4; color: #fff; border-radius: 4px; padding: 1px 4px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tag.plan { background: transparent !important; border: 1px dashed; padding: 0 3px; }
.more { font-size: 9px; color: var(--text-sub); text-align: center; }
.legend { display: flex; flex-wrap: wrap; gap: 14px; padding: 2px 14px 14px; font-size: 11px; color: var(--text-sub); }
.legend span { display: flex; align-items: center; gap: 5px; }
.legend i { width: 14px; height: 10px; border-radius: 3px; display: inline-block; }
.legend .lg-solid { background: var(--primary); }
.legend .lg-dash { border: 1px dashed var(--primary); }
.legend .lg-hol { background: #fff6f4; border: 1px solid #f0876b; }
.weekview { padding: 8px 12px; }
.wv-day { background: var(--card); border-radius: 12px; padding: 10px 12px; margin-bottom: 8px; border: 1.5px solid transparent; }
.wv-day.today { border-color: var(--primary); }
.wv-today { font-size: 10px; color: #fff; background: var(--primary); padding: 0 6px; border-radius: 5px; margin-left: 8px; font-weight: 700; }
.wv-d { font-size: 13px; font-weight: 700; margin-bottom: 6px; }
.wv-d small { color: var(--text-sub); font-weight: 500; margin-left: 6px; }
.wv-empty { font-size: 12px; color: var(--text-sub); }
.wv-item { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 13px; }
.wv-item .bar { width: 4px; height: 22px; border-radius: 3px; }
.wv-item .ct { font-weight: 600; }
.wv-item .tm { margin-left: auto; color: var(--text-sub); font-size: 12px; }
.planmark { font-size: 10px; color: var(--primary); background: var(--primary-soft); padding: 0 5px; border-radius: 5px; margin-left: 6px; font-weight: 600; }
.wv-hol { font-size: 10px; color: #f0876b; background: #fff1ee; padding: 0 6px; border-radius: 5px; margin-left: 8px; font-weight: 700; }
.today-panel { margin: 0 12px 18px; padding: 14px; background: var(--card); border-radius: 16px; box-shadow: 0 2px 10px rgba(20, 35, 70, .05); }
.today-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.today-panel-title { font-size: 16px; font-weight: 700; }
.today-panel-date { margin-top: 2px; font-size: 11px; color: var(--text-sub); }
.today-panel-count { padding: 3px 9px; border-radius: 10px; background: var(--primary-soft); color: var(--primary); font-size: 11px; font-weight: 700; }
.today-rec { margin-bottom: 8px; background: var(--bg); }
.today-rec:last-child { margin-bottom: 0; }
.today-empty { padding: 18px 0 10px; text-align: center; color: var(--text-sub); font-size: 13px; }
.fab { position: fixed; left: 50%; margin-left: 140px; bottom: 84px; width: 54px; height: 54px; border-radius: 50%; background: var(--primary); color: #fff; font-size: 30px; box-shadow: 0 8px 20px rgba(59,108,255,.4); z-index: 25; border: none; }

.mask { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 40; display: flex; align-items: flex-end; justify-content: center; }
.sheet { width: 100%; max-width: 420px; background: var(--bg); border-radius: 20px 20px 0 0; max-height: 92vh; overflow-y: auto; }
.sheet-head { position: sticky; top: 0; background: var(--bg); padding: 16px; display: flex; justify-content: space-between; border-bottom: 1px solid var(--line); }
.sheet-head .h { font-weight: 700; font-size: 16px; }
.close { font-size: 22px; color: var(--text-sub); background: none; border: none; }
.sheet-body { padding: 14px 16px 24px; }
.empty { text-align: center; color: var(--text-sub); padding: 24px 0; font-size: 14px; }
.rec { background: var(--card); border-radius: 14px; padding: 12px 14px; margin-bottom: 10px; }
.rtop { display: flex; align-items: center; gap: 8px; }
.bar { width: 4px; height: 20px; border-radius: 3px; }
.rnm { font-weight: 700; font-size: 15px; }
.st { font-size: 11px; padding: 1px 7px; border-radius: 6px; }
.st-attended { background: #e6f7ee; color: #1aa463; }
.st-leave { background: #fdecea; color: #e8694a; }
.st-reschedule { background: #fff4e0; color: #d99214; }
.st-plan { background: var(--primary-soft); color: var(--primary); }
.rec.plan { background: var(--card); border: 1px dashed #c2c8d2; }
.rops .confirm { color: var(--primary); font-weight: 700; }
.rops { margin-left: auto; display: flex; gap: 10px; }
.rops button { font-size: 13px; color: var(--text-sub); background: none; border: none; }
.rmeta { font-size: 12px; color: var(--text-sub); margin-top: 6px; display: flex; gap: 8px; flex-wrap: wrap; }
.rnote { font-size: 13px; margin-top: 8px; color: #4b5159; line-height: 1.5; }
.rphotos { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.thumb { width: 54px; height: 54px; border-radius: 8px; object-fit: cover; }
.photo-pick { display: flex; gap: 8px; flex-wrap: wrap; }
.ph { position: relative; width: 64px; height: 64px; }
.ph img { width: 64px; height: 64px; border-radius: 10px; object-fit: cover; }
.px { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,.6); color: #fff; font-size: 13px; line-height: 1; border: none; }
.addph { width: 64px; height: 64px; border-radius: 10px; border: 1.5px dashed #c2c8d2; display: flex; align-items: center; justify-content: center; color: var(--text-sub); font-size: 24px; cursor: pointer; margin: 0; }
.add { width: 100%; padding: 14px; border-radius: 14px; background: var(--primary-soft); color: var(--primary); font-weight: 700; font-size: 15px; border: none; }
label { display: block; font-size: 13px; font-weight: 600; margin: 16px 0 8px; }
.sheet-body > label:first-child { margin-top: 0; }
.hint { color: var(--text-sub); font-weight: 400; }
input[type=text], input[type=time], textarea { width: 100%; padding: 11px 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; background: var(--card); outline: none; }
input:focus, textarea:focus { border-color: var(--primary); }
.row { display: flex; gap: 10px; }
.combo { position: relative; }
.droplist { position: absolute; left: 0; right: 0; top: 48px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow); max-height: 220px; overflow-y: auto; z-index: 5; }
.opt { display: flex; align-items: center; gap: 9px; padding: 11px 12px; font-size: 14px; cursor: pointer; }
.opt:active { background: var(--bg); }
.opt .sw { width: 12px; height: 12px; border-radius: 3px; }
.opt.create { color: var(--primary); font-weight: 700; border-top: 1px solid var(--line); }
.statuspick { display: flex; gap: 8px; }
.statuspick button { flex: 1; padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 600; border: 1px solid var(--line); background: var(--card); color: var(--text-sub); }
.statuspick button.on { border-color: var(--primary); color: var(--primary); background: var(--primary-soft); }
.fee-input { display: flex; align-items: center; gap: 8px; }
.fee-input .yuan { font-size: 16px; font-weight: 700; color: var(--text-sub); }
.fee-input input { width: 100%; padding: 11px 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; background: var(--card); outline: none; }
.fee-input input:focus { border-color: var(--primary); }
.fee-input .unit { font-size: 13px; color: var(--text-sub); white-space: nowrap; }
.step { display: flex; align-items: center; gap: 14px; }
.step button { width: 34px; height: 34px; border-radius: 9px; background: var(--card); font-size: 20px; font-weight: 700; color: var(--primary); border: 1px solid var(--line); }
.step > span:first-of-type { font-size: 16px; font-weight: 700; min-width: 28px; text-align: center; }
.actions { display: flex; gap: 10px; margin-top: 22px; }
.ghost { flex: 1; padding: 13px; border-radius: 12px; background: var(--card); color: var(--text-sub); font-weight: 600; border: 1px solid var(--line); }
.primary { flex: 2; padding: 13px; border-radius: 12px; background: var(--primary); color: #fff; font-weight: 700; border: none; }
.toast { position: fixed; left: 50%; bottom: 90px; transform: translateX(-50%); background: rgba(0,0,0,.8); color: #fff; font-size: 13px; padding: 9px 16px; border-radius: 20px; z-index: 80; }
</style>
