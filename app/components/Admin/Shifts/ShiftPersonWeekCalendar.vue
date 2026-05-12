<script setup lang="ts">
import type { Practitioner, Shift, Store } from '@prisma/client'
import type { CalendarColumn, CalendarRange } from '../../Calendar/types'

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
  weekStart: string // YYYY-MM-DD (日曜)
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

// マスタ取得（予約割当可能なスタッフのみ。オーナー等の特別アカウントは除外）
const { data: staffList } = await useFetch<StaffWithStore[]>('/api/admin/staff', {
  query: { status: 'active', assignable: 'true' },
})
const { data: stores } = await useFetch<Store[]>('/api/admin/stores', {
  query: { status: 'active' },
})

// 店舗 → スタッフ の 2 段選択
const localStoreId = ref<number | null>(null)

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
  if (newId != null) {
    const firstInStore = (staffList.value ?? []).find(s => s.storeId === newId)
    emit('update:staffId', firstInStore?.id ?? null)
  }
  else {
    emit('update:staffId', null)
  }
}

// 7 日分の日付列挙
const days = computed(() => {
  const [y, m, d] = props.weekStart.split('-').map(Number)
  const start = new Date(y!, m! - 1, d!)
  const dowLabels = ['日', '月', '火', '水', '木', '金', '土']
  const result: { ymd: string, date: number, dayOfWeek: number, label: string }[] = []
  for (let i = 0; i < 7; i++) {
    const dt = new Date(start)
    dt.setDate(dt.getDate() + i)
    result.push({
      ymd: ymdOf(dt),
      date: dt.getDate(),
      dayOfWeek: dt.getDay(),
      label: dowLabels[dt.getDay()]!,
    })
  }
  return result
})
const rangeFrom = computed(() => days.value[0]?.ymd ?? '')
const rangeTo = computed(() => days.value[6]?.ymd ?? '')

// シフト・営業状況
const { data: shifts, refresh: refreshShifts } = await useFetch<ShiftWithJoins[]>('/api/admin/shifts', {
  query: computed(() => {
    if (props.staffId == null) return null
    return { from: rangeFrom.value, to: rangeTo.value }
  }),
  watch: [() => props.staffId, () => props.weekStart],
})
const { data: schedule } = await useFetch<ScheduleByDate[]>('/api/admin/schedule/by-range', {
  query: computed(() => ({ from: rangeFrom.value, to: rangeTo.value })),
  watch: [() => props.weekStart],
})

// 選択スタッフ分のシフトを (ymd → shift) に
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

// ── カレンダーへ渡す columns / ranges ──────────────────
const columns = computed<CalendarColumn[]>(() => {
  return days.value.map(d => ({
    id: d.ymd,
    label: `${d.label} ${d.date}`,
    headerClass: d.dayOfWeek === 0 ? 'text-red-600' : d.dayOfWeek === 6 ? 'text-blue-600' : '',
  }))
})

// shift.id → workStoreId を保持（更新時の維持用）
const shiftMeta = computed(() => {
  const map = new Map<string, { id: number, workStoreId: number | null }>()
  for (const [ymd, s] of shiftByYmd.value) {
    map.set(ymd, { id: s.id, workStoreId: s.workStoreId })
  }
  return map
})

const ranges = computed<CalendarRange[]>(() => {
  const result: CalendarRange[] = []
  for (const d of days.value) {
    const s = shiftByYmd.value.get(d.ymd)
    if (s) {
      result.push({
        id: `shift-${s.id}`,
        columnId: d.ymd,
        startTime: s.startTime,
        endTime: s.endTime,
      })
      continue
    }
    // シフト未設定 → メイン店舗営業時間でゴースト表示
    const sc = scheduleByYmd.value.get(d.ymd)
    if (!sc || sc.isHoliday || sc.isClosed) continue
    if (!sc.openTime || !sc.closeTime) continue
    result.push({
      id: `ghost-${d.ymd}`,
      columnId: d.ymd,
      startTime: sc.openTime,
      endTime: sc.closeTime,
      isGhost: true,
    } as CalendarRange)
  }
  return result
})

// ── 保存 ─────────────────────────────────────────────
const errorMessage = ref<string | null>(null)

async function saveShift(date: string, startTime: string, endTime: string, workStoreId: number | null) {
  if (props.staffId == null) return
  await $fetch('/api/admin/shifts', {
    method: 'POST',
    body: {
      practitionerId: props.staffId,
      date,
      startTime,
      endTime,
      workStoreId,
    },
  })
}

async function deleteShift(shiftId: number) {
  await $fetch(`/api/admin/shifts/${shiftId}`, { method: 'DELETE' })
}

function errMsg(e: unknown, fallback: string) {
  const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
  return err.data?.statusMessage || err.statusMessage || fallback
}

async function onRangeCreate(r: CalendarRange) {
  errorMessage.value = null
  try {
    await saveShift(String(r.columnId), r.startTime, r.endTime, null)
    await refreshShifts()
  }
  catch (e) {
    errorMessage.value = errMsg(e, 'シフトの作成に失敗しました')
    await refreshShifts()
  }
}

async function onRangeUpdate(r: CalendarRange) {
  errorMessage.value = null
  const meta = shiftMeta.value.get(String(r.columnId))
  try {
    await saveShift(String(r.columnId), r.startTime, r.endTime, meta?.workStoreId ?? null)
    await refreshShifts()
  }
  catch (e) {
    errorMessage.value = errMsg(e, 'シフトの更新に失敗しました')
    await refreshShifts()
  }
}

async function onRangeDelete(id: string) {
  errorMessage.value = null
  if (!id.startsWith('shift-')) return
  const shiftId = Number(id.slice('shift-'.length))
  if (!Number.isInteger(shiftId)) return
  try {
    await deleteShift(shiftId)
    await refreshShifts()
  }
  catch (e) {
    errorMessage.value = errMsg(e, 'シフトの削除に失敗しました')
    await refreshShifts()
  }
}

// ── ヘルプ先選択ポップオーバー ─────────────────────────
const helpPopover = ref<{
  ymd: string
  mainStoreId: number
  currentWorkStoreId: number | null
} | null>(null)

const helpPopoverOpen = computed({
  get: () => helpPopover.value !== null,
  set: (v: boolean) => { if (!v) helpPopover.value = null },
})

function onRangeClick(r: CalendarRange) {
  if (!selectedStaff.value) return
  const meta = shiftMeta.value.get(String(r.columnId))
  helpPopover.value = {
    ymd: String(r.columnId),
    mainStoreId: selectedStaff.value.storeId,
    currentWorkStoreId: meta?.workStoreId ?? null,
  }
}

async function applyHelpStore(workStoreId: number | null) {
  const p = helpPopover.value
  if (!p) return
  const r = ranges.value.find(x => String(x.columnId) === p.ymd && !(x as { isGhost?: boolean }).isGhost)
  if (!r) return
  errorMessage.value = null
  try {
    await saveShift(p.ymd, r.startTime, r.endTime, workStoreId)
    await refreshShifts()
    helpPopover.value = null
  }
  catch (e) {
    errorMessage.value = errMsg(e, 'ヘルプ先の更新に失敗しました')
  }
}

// 列ヘッダーにヘルプ先を表示
function headerNoteFor(ymd: string): string | null {
  const meta = shiftMeta.value.get(ymd)
  if (!meta || meta.workStoreId == null) return null
  const store = (stores.value ?? []).find(s => s.id === meta.workStoreId)
  return store ? `→ ${store.name}` : 'ヘルプ'
}

function onStaffChange(ev: Event) {
  const target = ev.target as HTMLSelectElement
  emit('update:staffId', Number(target.value) || null)
}

// 営業時間外日のラベル
function offDayLabel(ymd: string): string | null {
  const sc = scheduleByYmd.value.get(ymd)
  if (sc?.isHoliday) return '店休'
  if (sc?.isClosed) return '定休'
  return null
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

    <UAlert
      v-if="errorMessage"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="errorMessage"
    />

    <!-- 週カレンダー（Google Calendar 風）-->
    <div
      v-if="selectedStaff"
      class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    >
      <CalendarTimeColumnCalendar
        :ranges="ranges"
        :columns="columns"
        :max-ranges-per-column="1"
        empty-label="未出勤"
        @range-create="onRangeCreate"
        @range-update="onRangeUpdate"
        @range-delete="onRangeDelete"
        @range-click="onRangeClick"
      >
        <template #column-header="{ column }">
          <span :class="column.headerClass">{{ column.label }}</span>
          <span
            v-if="offDayLabel(String(column.id))"
            class="text-[10px] font-normal text-slate-500"
          >
            {{ offDayLabel(String(column.id)) }}
          </span>
          <span
            v-else-if="headerNoteFor(String(column.id))"
            class="text-[10px] font-normal text-purple-700"
          >
            {{ headerNoteFor(String(column.id)) }}
          </span>
        </template>
      </CalendarTimeColumnCalendar>
    </div>

    <div v-else-if="(staffList ?? []).length === 0" class="text-sm text-slate-500">
      アクティブなスタッフが登録されていません。
    </div>

    <p class="text-xs text-slate-500">
      空白部分を縦にドラッグして出勤時間を作成。バーをクリックでヘルプ先を切替できます。
    </p>

    <!-- ヘルプ先選択モーダル -->
    <UModal v-model:open="helpPopoverOpen">
      <template #content>
        <div v-if="helpPopover" class="bg-white p-5">
          <h2 class="text-base font-semibold text-slate-900 mb-3">
            {{ selectedStaff?.name }} さんの勤務先 ({{ helpPopover.ymd }})
          </h2>
          <p class="text-xs text-slate-600 mb-3">
            メイン所属店舗で勤務するか、別店舗にヘルプに行くかを選択します。
          </p>
          <div class="space-y-2">
            <button
              type="button"
              class="w-full text-left px-3 py-2 border rounded-sm hover:bg-[#f6f7f7]"
              :class="helpPopover.currentWorkStoreId === null ? 'border-orange-500 bg-orange-50' : 'border-[#c3c4c7]'"
              @click="applyHelpStore(null)"
            >
              <span class="text-sm font-semibold text-slate-900">
                メイン店舗で勤務
              </span>
              <span class="block text-xs text-slate-600 mt-0.5">
                ({{ (stores ?? []).find(s => s.id === helpPopover?.mainStoreId)?.name }})
              </span>
            </button>
            <button
              v-for="store in (stores ?? []).filter(s => s.id !== helpPopover?.mainStoreId)"
              :key="store.id"
              type="button"
              class="w-full text-left px-3 py-2 border rounded-sm hover:bg-[#f6f7f7]"
              :class="helpPopover.currentWorkStoreId === store.id ? 'border-orange-500 bg-orange-50' : 'border-[#c3c4c7]'"
              @click="applyHelpStore(store.id)"
            >
              <span class="text-sm font-semibold text-slate-900">
                ヘルプ: {{ store.name }}
              </span>
              <span class="block text-xs text-slate-600 mt-0.5">
                この日だけ他店舗で勤務
              </span>
            </button>
          </div>
          <div class="flex justify-end mt-4">
            <button
              type="button"
              class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
              @click="helpPopover = null"
            >
              キャンセル
            </button>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
