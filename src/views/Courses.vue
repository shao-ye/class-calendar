<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'

const COLORS = ['#3b6cff', '#1aa463', '#22b8cf', '#d99214', '#e8694a', '#b06bff', '#ec4899', '#0ea5e9']
const WD = ['一', '二', '三', '四', '五', '六', '日']

const courses = ref([])
const loading = ref(true)
const toastMsg = ref('')

// 编辑态
const editing = ref(false)
const isNew = ref(false)
const form = ref(null)
const saving = ref(false)

// 课时包态
const packages = ref([])
const editingPkgId = ref(null)   // 正在内联编辑的课时包 id；'new' 表示新增
const pkgForm = ref(null)

// 加载课程库
async function load() {
  loading.value = true
  try { courses.value = await api('/api/courses') }
  catch (e) { toast(e.message) }
  finally { loading.value = false }
}
onMounted(load)

// 计算结束时间显示
function endOf(c) {
  if (!c.defaultStart) return ''
  const [h, m] = c.defaultStart.split(':').map(Number)
  const t = (h * 60 + m + (c.defaultDuration || 60)) % 1440
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0')
}
// 星期摘要
function wdText(c) {
  if (!c.weekdays || !c.weekdays.length) return '未设上课星期'
  return '每' + c.weekdays.map(n => '周' + WD[n - 1]).join('、')
}

// 打开编辑（无参为新建）
async function openEdit(c) {
  isNew.value = !c
  form.value = c
    ? { ...c, weekdays: [...c.weekdays], end: endOf(c), note: c.note || '' }
    : { name: '', color: COLORS[0], defaultStart: '', defaultDuration: 60, weekdays: [], skipHoliday: true, trackHours: false, end: '', note: '' }
  packages.value = []
  editingPkgId.value = null
  editing.value = true
  // 已有的统计课时课程，加载其课时包
  if (c && c.trackHours) await loadPackages(c.id)
}
function closeEdit() { editing.value = false; form.value = null; packages.value = [] }

// ---------- 课时包 ----------
async function loadPackages(courseId) {
  try { packages.value = await api('/api/courses/' + courseId + '/packages') }
  catch (e) { toast(e.message) }
}
// 续费/新增：先确保课程已保存（有 id），再插入新包并进入编辑
async function addPackage() {
  if (isNew.value || !form.value.id) { toast('请先保存课程，再添加课时包'); return }
  try {
    const r = await api('/api/courses/' + form.value.id + '/packages', { method: 'POST', body: { total: 20, used: 0 } })
    await loadPackages(form.value.id)
    startEditPkg(r.id)
  } catch (e) { toast(e.message) }
}
function startEditPkg(id) {
  const p = packages.value.find(x => x.id === id)
  pkgForm.value = { total: p.total, used: p.used, date: p.date || '', amount: p.amount != null ? p.amount : '' }
  editingPkgId.value = id
}
function cancelEditPkg() { editingPkgId.value = null; pkgForm.value = null }
async function savePkg(id) {
  const f = pkgForm.value
  try {
    await api('/api/packages/' + id, {
      method: 'PUT',
      body: { total: Number(f.total), used: Number(f.used), purchaseDate: f.date || null, amount: f.amount === '' ? null : Number(f.amount) }
    })
    cancelEditPkg()
    await loadPackages(form.value.id)
    toast('已更新课时包')
  } catch (e) { toast(e.message) }
}
async function delPkg(id) {
  if (!confirm('删除该课时包？')) return
  try {
    await api('/api/packages/' + id, { method: 'DELETE' })
    cancelEditPkg()
    await loadPackages(form.value.id)
    toast('已删除课时包')
  } catch (e) { toast(e.message) }
}
// 平均课时费
function avgPrice(p) { return p.amount != null && p.total ? Math.round(p.amount / p.total) : null }

function toggleWeekday(wd) {
  const a = form.value.weekdays
  const i = a.indexOf(wd)
  if (i >= 0) a.splice(i, 1); else a.push(wd)
}

// 保存（新建或更新）
async function save() {
  const f = form.value
  if (!f.name.trim()) { toast('请填写课程名称'); return }
  // 用开始+结束算默认时长
  let duration = 60
  if (f.defaultStart && f.end) {
    const [h1, m1] = f.defaultStart.split(':').map(Number)
    const [h2, m2] = f.end.split(':').map(Number)
    duration = (h2 * 60 + m2) - (h1 * 60 + m1)
    if (duration <= 0) duration = 60
  }
  const payload = {
    name: f.name.trim(), color: f.color, defaultStart: f.defaultStart || null,
    defaultDuration: duration, weekdays: f.weekdays, skipHoliday: f.skipHoliday, trackHours: f.trackHours,
    note: f.note ? f.note.trim() : ''
  }
  saving.value = true
  try {
    if (isNew.value) await api('/api/courses', { method: 'POST', body: payload })
    else await api('/api/courses/' + f.id, { method: 'PUT', body: payload })
    closeEdit()
    await load()
    toast('已保存')
  } catch (e) { toast(e.message) }
  finally { saving.value = false }
}

// 删除
async function del() {
  if (!confirm('确定删除「' + form.value.name + '」？已有记录将保留为停用。')) return
  try {
    const r = await api('/api/courses/' + form.value.id, { method: 'DELETE' })
    closeEdit()
    await load()
    toast(r.softDeleted ? `已停用（保留 ${r.records} 条记录）` : '已删除')
  } catch (e) { toast(e.message) }
}

let toastTimer
function toast(msg) {
  toastMsg.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 1800)
}
</script>

<template>
  <div class="page">
    <div class="topbar">
      <div>
        <div class="title">课程库</div>
        <div class="sub">管理常上的课程</div>
      </div>
    </div>

    <div v-if="loading" class="empty">加载中…</div>
    <div v-else-if="!courses.length" class="empty">还没有课程，点下方新建</div>

    <div v-for="c in courses" :key="c.id" class="item" @click="openEdit(c)">
      <span class="swatch" :style="{ background: c.color }"></span>
      <div class="info">
        <div class="nm">{{ c.name }}<span v-if="c.trackHours" class="badge">课外班</span></div>
        <div class="meta">{{ c.defaultStart ? '🕐 ' + c.defaultStart + '-' + endOf(c) : '未设默认时间' }}</div>
        <div class="meta">{{ wdText(c) }}</div>
        <div v-if="c.note" class="meta note">📝 {{ c.note }}</div>
        <div v-if="c.trackHours" class="hours">
          <template v-if="c.activePackage">
            <div class="hb-track">
              <div class="hb-fill" :class="{ low: c.activePackage.remaining <= 3 }"
                :style="{ width: Math.round(c.activePackage.used / c.activePackage.total * 100) + '%' }"></div>
            </div>
            <div class="hb-label" :class="{ low: c.activePackage.remaining <= 3 }">
              剩 {{ c.activePackage.remaining }}/{{ c.activePackage.total }} 课时<span v-if="c.activePackage.remaining <= 3"> · 快用完了</span>
            </div>
          </template>
          <div v-else class="hb-label low">课时已用完 · 点击续费</div>
        </div>
      </div>
      <span class="arrow">›</span>
    </div>

    <button class="add" @click="openEdit(null)">＋ 新建课程</button>

    <!-- 编辑抽屉 -->
    <div v-if="editing" class="mask" @click.self="closeEdit">
      <div class="sheet">
        <div class="sheet-head">
          <div class="h">{{ isNew ? '新建课程' : '编辑课程' }}</div>
          <button class="close" @click="closeEdit">✕</button>
        </div>
        <div class="sheet-body" v-if="form">
          <label>课程名称</label>
          <input v-model="form.name" type="text" placeholder="如：英语、钢琴" />

          <label>颜色</label>
          <div class="colors">
            <span v-for="col in COLORS" :key="col" class="co" :class="{ on: form.color === col }"
              :style="{ background: col }" @click="form.color = col"></span>
          </div>

          <label>默认时间段 <span class="hint">· 选课自动带出</span></label>
          <div class="row">
            <input v-model="form.defaultStart" type="time" />
            <input v-model="form.end" type="time" />
          </div>

          <label>上课星期 <span class="hint">· 可多选，用于自动预排</span></label>
          <div class="wd-pick">
            <div v-for="(n, i) in WD" :key="i" class="wd" :class="{ on: form.weekdays.includes(i + 1) }"
              @click="toggleWeekday(i + 1)">{{ n }}</div>
          </div>

          <label>备注 <span class="hint">· 选填，如上课地点、老师、注意事项</span></label>
          <textarea v-model="form.note" rows="3" maxlength="200" placeholder="如：xx 教育 3 楼 302，王老师"></textarea>

          <div class="switch-row">
            <div><b>遇法定假日</b><div class="hint2">开：跳过假日不排课</div></div>
            <div class="switch" :class="{ on: form.skipHoliday }" @click="form.skipHoliday = !form.skipHoliday"></div>
          </div>
          <div class="switch-row">
            <div><b>统计课时</b><div class="hint2">课外补习班开启；学校课关闭</div></div>
            <div class="switch" :class="{ on: form.trackHours }" @click="form.trackHours = !form.trackHours"></div>
          </div>
          <div v-if="form.trackHours" class="pkg-wrap">
            <label>课时包 <span class="hint">· 循环统计，旧包自动归档</span></label>
            <div v-if="isNew || !form.id" class="pkg-note">保存课程后可添加课时包</div>
            <template v-else>
              <div v-for="p in [...packages].reverse()" :key="p.id" class="pkg" :class="{ active: p.status === 'active' }">
                <template v-if="editingPkgId === p.id">
                  <div class="prow">
                    <div class="pf"><label class="pl">购买总课时</label><input type="number" v-model="pkgForm.total" min="1" step="0.5" /></div>
                    <div class="pf"><label class="pl">已上课时</label><input type="number" v-model="pkgForm.used" min="0" step="0.5" /></div>
                  </div>
                  <div class="prow">
                    <div class="pf"><label class="pl">购买日期</label><input type="date" v-model="pkgForm.date" /></div>
                    <div class="pf"><label class="pl">金额(元)</label><input type="number" v-model="pkgForm.amount" min="0" placeholder="如 3200" /></div>
                  </div>
                  <div class="pacts">
                    <button class="pdel" @click="delPkg(p.id)">删除</button>
                    <button class="pghost" @click="cancelEditPkg">取消</button>
                    <button class="pprimary" @click="savePkg(p.id)">确定</button>
                  </div>
                </template>
                <template v-else>
                  <div class="pt">
                    <b>{{ p.total }} 课时包</b>
                    <span class="pright">
                      <button v-if="p.status === 'active'" class="padj" @click="startEditPkg(p.id)">调整</button>
                      <span class="ptag" :class="p.status === 'active' ? 'ta' : 'td'">{{ p.status === 'active' ? '生效中' : '已用完' }}</span>
                    </span>
                  </div>
                  <div class="pinfo">{{ p.date || '未填日期' }} · 已上 {{ p.used }}/{{ p.total }}<b v-if="p.status === 'active'" class="rem"> · 剩 {{ p.remaining }} 课时</b></div>
                  <div v-if="p.amount != null" class="pinfo">💰 {{ p.amount }} 元 · 平均 {{ avgPrice(p) }} 元/课时</div>
                </template>
              </div>
              <div v-if="!packages.length" class="pkg-note">还没有课时包</div>
              <button class="add-pkg" @click="addPackage">＋ 续费 / 新增课时包</button>
            </template>
          </div>

          <div class="actions">
            <button v-if="!isNew" class="del" @click="del">删除</button>
            <button class="ghost" @click="closeEdit">取消</button>
            <button class="primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; padding-bottom: 80px; }
.topbar { background: var(--card); padding: 14px 16px; border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 10; }
.title { font-size: 18px; font-weight: 700; }
.sub { font-size: 12px; color: var(--text-sub); }
.empty { text-align: center; color: var(--text-sub); padding: 40px 0; font-size: 14px; }
.item { display: flex; align-items: center; gap: 12px; background: var(--card); margin: 8px 12px; padding: 14px; border-radius: 14px; box-shadow: var(--shadow); cursor: pointer; }
.swatch { width: 14px; height: 14px; border-radius: 4px; flex-shrink: 0; }
.info { flex: 1; min-width: 0; }
.nm { font-weight: 600; font-size: 15px; }
.badge { font-size: 10px; color: #d99214; background: #fff4e0; padding: 1px 6px; border-radius: 6px; margin-left: 6px; }
.meta { font-size: 12px; color: var(--text-sub); margin-top: 3px; }
.meta.note { white-space: pre-wrap; word-break: break-word; }
.arrow { color: var(--text-sub); }
.add { width: calc(100% - 24px); margin: 8px 12px; padding: 14px; border-radius: 14px; background: var(--primary-soft); color: var(--primary); font-weight: 700; font-size: 15px; }

.mask { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 40; display: flex; align-items: flex-end; justify-content: center; }
.sheet { width: 100%; max-width: 420px; background: var(--bg); border-radius: 20px 20px 0 0; max-height: 92vh; overflow-y: auto; }
.sheet-head { position: sticky; top: 0; background: var(--bg); padding: 16px; display: flex; justify-content: space-between; border-bottom: 1px solid var(--line); }
.sheet-head .h { font-weight: 700; font-size: 16px; }
.close { font-size: 22px; color: var(--text-sub); }
.sheet-body { padding: 16px; }
.sheet-body label { display: block; font-size: 13px; font-weight: 600; margin: 16px 0 8px; }
.sheet-body label:first-child { margin-top: 0; }
.hint { color: var(--text-sub); font-weight: 400; }
.hint2 { font-size: 12px; color: var(--text-sub); margin-top: 4px; }
input[type=text], input[type=time], textarea { width: 100%; padding: 11px 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; background: var(--card); outline: none; }
textarea { resize: vertical; font-family: inherit; line-height: 1.5; }
input:focus, textarea:focus { border-color: var(--primary); }
.row { display: flex; gap: 10px; }
.colors { display: flex; gap: 10px; flex-wrap: wrap; }
.co { width: 30px; height: 30px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; }
.co.on { border-color: var(--text); }
.wd-pick { display: flex; gap: 6px; }
.wd { flex: 1; text-align: center; padding: 9px 0; border-radius: 9px; background: var(--card); border: 1px solid var(--line); font-size: 13px; font-weight: 600; color: var(--text-sub); cursor: pointer; }
.wd.on { background: var(--primary); border-color: var(--primary); color: #fff; }
.switch-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; }
.switch { width: 46px; height: 26px; border-radius: 13px; background: #d4d8e0; position: relative; transition: .2s; flex-shrink: 0; cursor: pointer; }
.switch.on { background: var(--primary); }
.switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: .2s; }
.switch.on::after { left: 23px; }
.pkg-note { margin-top: 10px; font-size: 13px; color: var(--text-sub); background: var(--card); padding: 12px; border-radius: 10px; }
/* 列表卡片课时进度 */
.hours { margin-top: 7px; }
.hb-track { height: 7px; background: var(--bg); border-radius: 4px; overflow: hidden; }
.hb-fill { height: 100%; border-radius: 4px; background: var(--primary); }
.hb-fill.low { background: #e8694a; }
.hb-label { font-size: 11px; color: var(--primary); margin-top: 4px; font-weight: 600; }
.hb-label.low { color: #e8694a; }
/* 课时包 */
.pkg-wrap { margin-top: 6px; }
.pkg { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; margin-top: 8px; }
.pkg.active { border-color: var(--primary); }
.pt { display: flex; align-items: center; justify-content: space-between; }
.pt b { font-size: 14px; }
.pright { display: inline-flex; align-items: center; gap: 8px; }
.padj { font-size: 12px; color: var(--primary); font-weight: 600; background: var(--primary-soft); padding: 2px 9px; border-radius: 7px; }
.ptag { font-size: 10px; padding: 1px 7px; border-radius: 6px; }
.ptag.ta { background: var(--primary-soft); color: var(--primary); }
.ptag.td { background: var(--bg); color: var(--text-sub); }
.pinfo { font-size: 12px; color: var(--text-sub); margin-top: 6px; }
.rem { color: var(--primary); }
.prow { display: flex; gap: 10px; }
.pf { flex: 1; }
.pl { display: block; font-size: 12px; font-weight: 600; margin: 0 0 6px; }
.prow + .prow { margin-top: 8px; }
.pkg input[type=number], .pkg input[type=date] { width: 100%; padding: 10px; border: 1px solid var(--line); border-radius: 9px; font-size: 14px; outline: none; }
.pacts { display: flex; gap: 8px; margin-top: 10px; }
.pdel { padding: 9px 12px; border-radius: 9px; background: #fdecea; color: #e8694a; font-weight: 600; }
.pghost { flex: 1; padding: 9px; border-radius: 9px; background: var(--bg); color: var(--text-sub); font-weight: 600; }
.pprimary { flex: 1; padding: 9px; border-radius: 9px; background: var(--primary); color: #fff; font-weight: 700; }
.add-pkg { width: 100%; margin-top: 10px; padding: 12px; border-radius: 11px; background: var(--primary-soft); color: var(--primary); font-weight: 700; }
.actions { display: flex; gap: 10px; margin-top: 22px; }
.del { padding: 13px; border-radius: 12px; background: #fdecea; color: #e8694a; font-weight: 700; }
.ghost { flex: 1; padding: 13px; border-radius: 12px; background: var(--card); color: var(--text-sub); font-weight: 600; border: 1px solid var(--line); }
.primary { flex: 2; padding: 13px; border-radius: 12px; background: var(--primary); color: #fff; font-weight: 700; }
.primary:disabled { opacity: .6; }
.toast { position: fixed; left: 50%; bottom: 40px; transform: translateX(-50%); background: rgba(0,0,0,.8); color: #fff; font-size: 13px; padding: 9px 16px; border-radius: 20px; z-index: 80; }
</style>
