<script setup lang="ts">
import type { Practitioner, Shift, Store } from '@prisma/client'

type StaffWithStore = Practitioner & { store: Pick<Store, 'id' | 'name'> }
type ShiftWithJoins = Shift & {
  practitioner: { id: number, name: string, storeId: number, store: Pick<Store, 'id' | 'name'> }
  workStore: Pick<Store, 'id' | 'name'> | null
}
type ScheduleByDate = {
  store: { id: number, name: string, slug: string }
  date: string
  dayOfWeek: number
  isHoliday: boolean
  isPublicHoliday: boolean
  publicHolidayName: string | null
  isClosed: boolean
  openTime: string | null
  closeTime: string | null
}

const props = defineProps<{
  staffId: number | null
  month: string // "YYYY-MM"
}>()
const emit = defineEmits<{
  (e: 'update:staffId', value: number | null): void
}>()

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ── スタッフ一覧 ───────────────────────────────────────
const { data: staffList } = await useFetch<StaffWithStore[]>('/api/admin/staff', {
  query: { status: 'active' },
})
const { data: stores } = await useFetch<Store[]>('/api/admin/stores', {
  query: { status: 'active' },
})

// 店舗 → スタッフ の 2 段選択
const localStoreId = ref<number | null>(null)

// 初期化／同期:
// - staffId が指定済なら、そのスタッフの所属店舗を localStoreId に反映
// - staffId 未指定なら、最初の店舗 → その店舗の最初のスタッフを自動選択
watch([() => props.staffId, staffList, stores], ([id, list, sList]) => {
  if (!list || !sList) return
  if (id != null) {
    const s = list.find(x => x.id === id)
    if (s) localStoreId.value = s.storeId
    return
  }
  const firstStore = localStoreId.value != null
    ? sList.find(s => s.id === localStoreId.value)
    : sList[0]
  if (!firstStore) return
  localStoreId.value = firstStore.id
  const firstStaff = list.find(x => x.storeId === firstStore.id)
  if (firstStaff) emit('update:staffId', firstStaff.id)
}, { immediate: true })

const filteredStaff = computed<StaffWithStore[]>(() => {
  if (localStoreId.value == null) return []
  return (staffList.value ?? []).filter(s => s.storeId === localStoreId.value)
})

const selectedStaff = computed<StaffWithStore | null>(() => {
  const id = props.staffId
  if (id == null) return null
  return (staffList.value ?? []).find(s => s.id === id) ?? null
})

function onStoreChange(ev: Event) {
  const target = ev.target as HTMLSelectElement
  const newId = Number(target.value) || null
  localStoreId.value = newId
  // 新しい店舗の最初のスタッフを自動選択
  if (newId != null) {
    const firstInStore = (staffList.value ?? []).find(s => s.storeId === newId)
    emit('update:staffId', firstInStore?.id ?? null)
  }
  else {
    emit('update:staffId', null)
  }
}

// ── 月のグリッド構築（日曜始まり、6 行）────────────────
type Cell = {
  date: number
  ymd: string
  isCurrentMonth: boolean
  isToday: boolean
  dayOfWeek: number
}
const cells = computed<Cell[]>(() => {
  const m = props.month.match(/^(\d{4})-(\d{2})$/)
  if (!m) return []
  const y = Number(m[1])
  const mo = Number(m[2])
  const firstDay = new Date(y, mo - 1, 1)
  const startOffset = firstDay.getDay()
  const start = new Date(y, mo - 1, 1 - startOffset)
  const today = ymdOf(new Date())
  const list: Cell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const ymd = ymdOf(d)
    list.push({
      date: d.getDate(),
      ymd,
      isCurrentMonth: d.getMonth() === mo - 1,
      isToday: ymd === today,
      dayOfWeek: d.getDay(),
    })
  }
  // 最後の週が完全に翌月なら省略
  while (list.length > 35 && list.slice(-7).every(c => !c.isCurrentMonth)) {
    list.splice(-7, 7)
  }
  return list
})

const rangeFrom = computed(() => cells.value[0]?.ymd ?? '')
const rangeTo = computed(() => cells.value[cells.value.length - 1]?.ymd ?? '')

// ── データ取得 ──────────────────────────────────────────
const { data: shifts, refresh: refreshShifts } = await useFetch<ShiftWithJoins[]>('/api/admin/shifts', {
  query: computed(() => {
    if (props.staffId == null) return null
    return { from: rangeFrom.value, to: rangeTo.value }
  }),
  watch: [() => props.staffId, () => props.month],
})

const { data: schedule } = await useFetch<ScheduleByDate[]>('/api/admin/schedule/by-range', {
  query: computed(() => ({ from: rangeFrom.value, to: rangeTo.value })),
  watch: [() => props.month],
})

// 選択スタッフ分だけのシフト Map (ymd → shift)
const shiftByYmd = computed(() => {
  const map = new Map<string, ShiftWithJoins>()
  if (props.staffId == null) return map
  for (const s of shifts.value ?? []) {
    if (s.practitionerId !== props.staffId) continue
    map.set(ymdOf(new Date(s.date)), s)
  }
  return map
})

// メイン店舗の営業情報 (ymd → schedule)
const scheduleByYmd = computed(() => {
  const map = new Map<string, ScheduleByDate>()
  if (!selectedStaff.value) return map
  const storeId = selectedStaff.value.storeId
  for (const sc of schedule.value ?? []) {
    if (sc.store.id !== storeId) continue
    map.set(sc.date, sc)
  }
  return map
})

// ── ドラッグ選択 ───────────────────────────────────────
const dragAnchor = ref<string | null>(null)
const dragCursor = ref<string | null>(null)
const isDragging = ref(false)

function ymdCompare(a: string, b: string): number {
  return a.localeCompare(b)
}

// 選択中（ドラッグ中 or 確定）の日付集合
const selectedYmds = computed<Set<string>>(() => {
  if (!dragAnchor.value || !dragCursor.value) return new Set()
  const [from, to] = ymdCompare(dragAnchor.value, dragCursor.value) <= 0
    ? [dragAnchor.value, dragCursor.value]
    : [dragCursor.value, dragAnchor.value]
  const set = new Set<string>()
  for (const c of cells.value) {
    if (ymdCompare(c.ymd, from) >= 0 && ymdCompare(c.ymd, to) <= 0) {
      set.add(c.ymd)
    }
  }
  return set
})

function onCellPointerDown(c: Cell, ev: PointerEvent) {
  if (!c.isCurrentMonth) return
  ev.preventDefault()
  dragAnchor.value = c.ymd
  dragCursor.value = c.ymd
  isDragging.value = true
}

function onCellPointerEnter(c: Cell) {
  if (!isDragging.value) return
  if (!c.isCurrentMonth) return
  dragCursor.value = c.ymd
}

// ポップオーバー表示
const showPopover = ref(false)
const popoverPosition = ref<{ x: number, y: number }>({ x: 0, y: 0 })

function onPointerUp(ev: PointerEvent) {
  if (!isDragging.value) return
  isDragging.value = false
  // 選択がある場合、ポップオーバーを開く
  if (selectedYmds.value.size > 0) {
    popoverPosition.value = { x: ev.clientX, y: ev.clientY }
    // 既存シフトがあれば input を初期化
    initPopoverFromSelection()
    showPopover.value = true
  }
}

function cancelSelection() {
  dragAnchor.value = null
  dragCursor.value = null
  showPopover.value = false
}

// グローバル pointerup を購読（マウスがセル外で離されても確定する）
onMounted(() => {
  window.addEventListener('pointerup', onPointerUp)
})
onUnmounted(() => {
  window.removeEventListener('pointerup', onPointerUp)
})

// ── ポップオーバー入力 ─────────────────────────────────
const inputStartTime = ref('09:30')
const inputEndTime = ref('18:00')
const inputWorkStoreId = ref<number | null>(null) // null = メイン店舗
const submitting = ref(false)
const errorMessage = ref<string | null>(null)

function initPopoverFromSelection() {
  errorMessage.value = null
  // 選択範囲内に既存シフトが 1 件だけある場合、その値で初期化
  const existingList: ShiftWithJoins[] = []
  for (const ymd of selectedYmds.value) {
    const s = shiftByYmd.value.get(ymd)
    if (s) existingList.push(s)
  }
  if (existingList.length === 1) {
    const s = existingList[0]!
    inputStartTime.value = s.startTime
    inputEndTime.value = s.endTime
    inputWorkStoreId.value = s.workStoreId
    return
  }
  if (existingList.length > 1) {
    // 全部同じ時間帯なら採用、違えばデフォルト
    const first = existingList[0]!
    const allSame = existingList.every(x => x.startTime === first.startTime && x.endTime === first.endTime && x.workStoreId === first.workStoreId)
    if (allSame) {
      inputStartTime.value = first.startTime
      inputEndTime.value = first.endTime
      inputWorkStoreId.value = first.workStoreId
      return
    }
  }
  // デフォルト: メイン店舗の営業時間
  const firstSelectedYmd = Array.from(selectedYmds.value).sort()[0]!
  const sc = scheduleByYmd.value.get(firstSelectedYmd)
  if (sc?.openTime && sc?.closeTime) {
    inputStartTime.value = sc.openTime
    inputEndTime.value = sc.closeTime
  }
  else {
    inputStartTime.value = '09:30'
    inputEndTime.value = '18:00'
  }
  inputWorkStoreId.value = null
}

async function applyBulk() {
  if (props.staffId == null) return
  errorMessage.value = null
  if (inputStartTime.value >= inputEndTime.value) {
    errorMessage.value = '終了時刻は開始時刻より後にしてください'
    return
  }
  submitting.value = true
  try {
    // 並列で upsert（小規模想定のため十分）
    await Promise.all(Array.from(selectedYmds.value).map(ymd =>
      $fetch('/api/admin/shifts', {
        method: 'POST',
        body: {
          practitionerId: props.staffId,
          date: ymd,
          startTime: inputStartTime.value,
          endTime: inputEndTime.value,
          workStoreId: inputWorkStoreId.value,
        },
      }),
    ))
    await refreshShifts()
    cancelSelection()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || '一括保存に失敗しました'
  }
  finally {
    submitting.value = false
  }
}

async function deleteBulk() {
  if (props.staffId == null) return
  errorMessage.value = null
  submitting.value = true
  try {
    const targets: number[] = []
    for (const ymd of selectedYmds.value) {
      const s = shiftByYmd.value.get(ymd)
      if (s) targets.push(s.id)
    }
    await Promise.all(targets.map(id =>
      $fetch(`/api/admin/shifts/${id}`, { method: 'DELETE' }),
    ))
    await refreshShifts()
    cancelSelection()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || '削除に失敗しました'
  }
  finally {
    submitting.value = false
  }
}

// 選択範囲のラベル
const selectionLabel = computed(() => {
  if (selectedYmds.value.size === 0) return ''
  const sorted = Array.from(selectedYmds.value).sort()
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  if (first === last) {
    const [y, m, d] = first.split('-').map(Number)
    return `${y}年${m}月${d}日`
  }
  const [y1, m1, d1] = first.split('-').map(Number)
  const [, m2, d2] = last.split('-').map(Number)
  if (m1 === m2) return `${y1}年${m1}月${d1}日 – ${d2}日 (${selectedYmds.value.size} 日間)`
  return `${y1}年${m1}月${d1}日 – ${m2}月${d2}日 (${selectedYmds.value.size} 日間)`
})

// ── スタイルヘルパ ─────────────────────────────────────
function onStaffChange(ev: Event) {
  const target = ev.target as HTMLSelectElement
  emit('update:staffId', Number(target.value) || null)
}

function dowColorClass(dow: number): string {
  if (dow === 0) return 'text-red-600'
  if (dow === 6) return 'text-blue-600'
  return 'text-slate-700'
}

function cellBgClass(c: Cell): string {
  if (!c.isCurrentMonth) return 'bg-[#f9fafb] text-slate-400'
  if (selectedYmds.value.has(c.ymd)) return 'bg-orange-200/70'
  const sc = scheduleByYmd.value.get(c.ymd)
  if (sc?.isHoliday) return 'bg-red-50'
  if (sc?.isClosed) return 'bg-slate-100'
  if (sc?.isPublicHoliday) return 'bg-orange-50/40'
  return 'bg-white'
}
</script>

<template>
  <div class="space-y-4">
    <!-- 店舗 → スタッフ の 2 段選択 -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm p-3 flex items-center gap-3 flex-wrap">
      <label class="text-sm font-semibold text-slate-700">店舗:</label>
      <select
        :value="localStoreId ?? ''"
        class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
        @change="onStoreChange"
      >
        <option value="" disabled>
          選んでください
        </option>
        <option
          v-for="s in (stores ?? [])"
          :key="s.id"
          :value="s.id"
        >
          {{ s.name }}
        </option>
      </select>

      <label class="text-sm font-semibold text-slate-700">スタッフ:</label>
      <select
        :value="staffId ?? ''"
        class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-400"
        :disabled="filteredStaff.length === 0"
        @change="onStaffChange"
      >
        <option value="" disabled>
          選んでください
        </option>
        <option
          v-for="s in filteredStaff"
          :key="s.id"
          :value="s.id"
        >
          {{ s.name }}
        </option>
      </select>

      <p v-if="filteredStaff.length === 0 && localStoreId" class="text-xs text-slate-500">
        この店舗にはアクティブなスタッフがいません
      </p>
    </div>

    <!-- 月カレンダー -->
    <div
      v-if="selectedStaff"
      class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden select-none"
    >
      <!-- 曜日ヘッダー -->
      <div class="grid grid-cols-7 border-b border-[#c3c4c7] bg-[#f6f7f7]">
        <div
          v-for="(label, i) in ['日', '月', '火', '水', '木', '金', '土']"
          :key="i"
          class="px-2 py-1.5 text-xs font-semibold text-center"
          :class="dowColorClass(i)"
        >
          {{ label }}
        </div>
      </div>

      <!-- セル -->
      <div class="grid grid-cols-7">
        <div
          v-for="(c, i) in cells"
          :key="i"
          class="border-r border-b border-[#dcdcde] last:border-r-0 p-1.5 flex flex-col gap-1 min-h-[88px] cursor-pointer relative"
          :class="[
            cellBgClass(c),
            c.isToday && c.isCurrentMonth ? 'ring-2 ring-orange-400 ring-inset' : '',
            (i + 1) % 7 === 0 ? 'border-r-0' : '',
          ]"
          @pointerdown="onCellPointerDown(c, $event)"
          @pointerenter="onCellPointerEnter(c)"
        >
          <span
            class="text-xs font-semibold tabular-nums"
            :class="[
              c.isCurrentMonth ? dowColorClass(c.dayOfWeek) : 'text-slate-400',
              c.isToday && c.isCurrentMonth ? 'text-orange-600' : '',
            ]"
          >
            {{ c.date }}
          </span>
          <template v-if="c.isCurrentMonth && shiftByYmd.get(c.ymd)">
            <div
              class="text-[11px] font-medium tabular-nums leading-tight"
              :class="shiftByYmd.get(c.ymd)?.workStoreId ? 'text-purple-700' : 'text-slate-900'"
            >
              {{ shiftByYmd.get(c.ymd)?.startTime }}–{{ shiftByYmd.get(c.ymd)?.endTime }}
            </div>
            <div
              v-if="shiftByYmd.get(c.ymd)?.workStoreId"
              class="text-[10px] text-purple-700 truncate"
            >
              → {{ (stores ?? []).find(s => s.id === shiftByYmd.get(c.ymd)?.workStoreId)?.name ?? 'ヘルプ' }}
            </div>
          </template>
          <template v-else-if="c.isCurrentMonth && scheduleByYmd.get(c.ymd)?.isHoliday">
            <div class="text-[10px] text-red-700">
              店休
            </div>
          </template>
          <template v-else-if="c.isCurrentMonth && scheduleByYmd.get(c.ymd)?.isClosed">
            <div class="text-[10px] text-slate-400">
              定休
            </div>
          </template>
        </div>
      </div>
    </div>

    <div v-else-if="(staffList ?? []).length === 0" class="text-sm text-slate-500">
      アクティブなスタッフが登録されていません。先にスタッフを追加してください。
    </div>

    <p class="text-xs text-slate-500">
      日付をドラッグして範囲選択 → 出勤時間を入力。すでにシフトがある日は上書きされます。
    </p>

    <!-- 一括入力ポップオーバー（モーダル風）-->
    <UModal v-model:open="showPopover">
      <template #content>
        <div class="bg-white p-5 min-w-[360px]">
          <h2 class="text-base font-semibold text-slate-900 mb-2">
            シフトを一括登録
          </h2>
          <p class="text-sm text-slate-700 mb-1">
            <strong>{{ selectedStaff?.name }}</strong> さん / {{ selectionLabel }}
          </p>

          <UAlert
            v-if="errorMessage"
            color="error"
            icon="i-lucide-triangle-alert"
            :title="errorMessage"
            class="my-3"
          />

          <div class="grid grid-cols-2 gap-3 my-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">
                開始
              </label>
              <input
                v-model="inputStartTime"
                type="time"
                step="1800"
                class="w-full px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm focus:outline-none focus:border-orange-500"
              >
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">
                終了
              </label>
              <input
                v-model="inputEndTime"
                type="time"
                step="1800"
                class="w-full px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm focus:outline-none focus:border-orange-500"
              >
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-xs font-semibold text-slate-700 mb-1">
              勤務先
            </label>
            <select
              v-model="inputWorkStoreId"
              class="w-full px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
            >
              <option :value="null">
                メイン店舗（{{ selectedStaff?.store.name }}）
              </option>
              <option
                v-for="st in (stores ?? []).filter(s => s.id !== selectedStaff?.storeId)"
                :key="st.id"
                :value="st.id"
              >
                ヘルプ: {{ st.name }}
              </option>
            </select>
          </div>

          <div class="flex items-center justify-between gap-2">
            <button
              type="button"
              class="px-3 py-1.5 text-sm border border-red-300 text-red-700 hover:bg-red-50 rounded-sm disabled:opacity-50"
              :disabled="submitting"
              @click="deleteBulk"
            >
              選択範囲のシフトを削除
            </button>
            <div class="flex gap-2">
              <button
                type="button"
                class="px-3 py-1.5 text-sm border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 rounded-sm"
                @click="cancelSelection"
              >
                キャンセル
              </button>
              <button
                type="button"
                class="px-4 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-sm"
                :disabled="submitting"
                @click="applyBulk"
              >
                {{ submitting ? '保存中...' : '一括登録' }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
