<script setup lang="ts">
import type { Practitioner, Shift, Store } from '@prisma/client'

type StaffWithStore = Practitioner & { store: Pick<Store, 'id' | 'name'> }
type ShiftWithJoins = Shift & {
  practitioner: StaffWithStore
  workStore: Pick<Store, 'id' | 'name'> | null
}
type ScheduleByDate = {
  store: { id: number, name: string, slug: string }
  date: string
  dayOfWeek: number
  isHoliday: boolean
  holidayNote: string | null
  isPublicHoliday: boolean
  publicHolidayName: string | null
  isClosed: boolean
  openTime: string | null
  closeTime: string | null
}

const props = defineProps<{
  /** 週の開始日 (YYYY-MM-DD, 日曜始まり) */
  weekStart: string
}>()

const router = useRouter()
const route = useRoute()

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 7 日分の日付列挙
const days = computed(() => {
  const [y, m, d] = props.weekStart.split('-').map(Number)
  const start = new Date(y!, m! - 1, d!)
  const result: { ymd: string, date: number, dayOfWeek: number, label: string }[] = []
  const dowLabels = ['日', '月', '火', '水', '木', '金', '土']
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

const weekEnd = computed(() => days.value[6]!.ymd)

// データ取得
const { data: staffList } = await useFetch<StaffWithStore[]>('/api/admin/staff', {
  query: { status: 'active' },
})
const { data: shifts } = await useFetch<ShiftWithJoins[]>('/api/admin/shifts', {
  query: computed(() => ({ from: props.weekStart, to: weekEnd.value })),
  watch: [() => props.weekStart],
})
const { data: schedule } = await useFetch<ScheduleByDate[]>('/api/admin/schedule/by-range', {
  query: computed(() => ({ from: props.weekStart, to: weekEnd.value })),
  watch: [() => props.weekStart],
})

// (practitionerId, ymd) → shift
const shiftMap = computed(() => {
  const map = new Map<string, ShiftWithJoins>()
  for (const s of shifts.value ?? []) {
    const key = `${s.practitionerId}:${ymdOf(new Date(s.date))}`
    map.set(key, s)
  }
  return map
})

// (storeId, ymd) → schedule
const scheduleMap = computed(() => {
  const map = new Map<string, ScheduleByDate>()
  for (const sc of schedule.value ?? []) {
    map.set(`${sc.store.id}:${sc.date}`, sc)
  }
  return map
})

// 店舗ごとに、行ごとのセル配列をあらかじめ組み立てる（テンプレートで非null!アサーション不要にするため）
type CellInfo = {
  ymd: string
  bgClass: string
  shiftTimeLabel: string | null
  helpLabel: string | null
  emptyLabel: { text: string, color: string } | null
}

function dowColorClass(dow: number): string {
  if (dow === 0) return 'text-red-600'
  if (dow === 6) return 'text-blue-600'
  return 'text-slate-700'
}

function buildCells(staff: StaffWithStore): CellInfo[] {
  return days.value.map((d) => {
    const sh = shiftMap.value.get(`${staff.id}:${d.ymd}`) ?? null
    const sc = scheduleMap.value.get(`${staff.storeId}:${d.ymd}`) ?? null
    let bgClass = 'bg-white'
    if (sc?.isHoliday) bgClass = 'bg-red-50'
    else if (sc?.isClosed) bgClass = 'bg-slate-100'
    else if (sc?.isPublicHoliday) bgClass = 'bg-orange-50/40'

    let shiftTimeLabel: string | null = null
    let helpLabel: string | null = null
    let emptyLabel: { text: string, color: string } | null = null

    if (sh) {
      shiftTimeLabel = `${sh.startTime}–${sh.endTime}`
      if (sh.workStoreId != null) {
        helpLabel = sh.workStore?.name ?? 'ヘルプ'
      }
    }
    else if (sc?.isHoliday) {
      emptyLabel = { text: '店休', color: 'text-red-700' }
    }
    else if (sc?.isClosed) {
      emptyLabel = { text: '定休', color: 'text-slate-400' }
    }
    else {
      emptyLabel = { text: '—', color: 'text-slate-300' }
    }

    return { ymd: d.ymd, bgClass, shiftTimeLabel, helpLabel, emptyLabel }
  })
}

type GroupRow = { staff: StaffWithStore, cells: CellInfo[] }
type GroupView = {
  store: { id: number, name: string }
  staff: StaffWithStore[]
  rows: GroupRow[]
}

const groupedStaff = computed<GroupView[]>(() => {
  const list = staffList.value ?? []
  const map = new Map<number, GroupView>()
  for (const s of list) {
    if (!map.has(s.storeId)) {
      map.set(s.storeId, { store: s.store, staff: [], rows: [] })
    }
    map.get(s.storeId)!.staff.push(s)
  }
  // rows を組み立て
  for (const g of map.values()) {
    g.rows = g.staff.map(staff => ({ staff, cells: buildCells(staff) }))
  }
  return Array.from(map.values())
})

function onCellClick(ymd: string) {
  router.replace({ query: { ...route.query, view: 'day', date: ymd } })
}

// 折りたたみ状態
const { isCollapsed, toggle: toggleCollapse } = useShiftStoreCollapse()

// 折りたたみ概要：その週の出勤延べ人数（シフト件数）
function weekShiftCountFor(storeId: number): number {
  return (shifts.value ?? []).filter((s) => {
    const actualStoreId = s.workStoreId ?? s.practitioner.storeId
    return actualStoreId === storeId
  }).length
}

// 折りたたみ概要：その週のうち店休日の数
function holidayCountFor(storeId: number): number {
  return (schedule.value ?? []).filter(sc => sc.store.id === storeId && (sc.isHoliday || sc.isClosed)).length
}
</script>

<template>
  <div class="space-y-4">
    <!-- 店舗グループごと -->
    <div
      v-for="g in groupedStaff"
      :key="g.store.id"
      class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
    >
      <button
        type="button"
        class="w-full px-4 py-2.5 border-b border-[#dcdcde] flex items-center justify-between gap-3 hover:bg-[#f6f7f7] transition-colors text-left"
        :class="isCollapsed(g.store.id) ? 'border-b-transparent' : ''"
        @click="toggleCollapse(g.store.id)"
      >
        <div class="flex items-center gap-2">
          <UIcon
            :name="isCollapsed(g.store.id) ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
            class="size-4 text-slate-500"
          />
          <h3 class="text-sm font-semibold text-slate-900">
            {{ g.store.name }}
          </h3>
        </div>
        <span
          v-if="isCollapsed(g.store.id)"
          class="text-xs text-slate-600 flex items-center gap-3"
        >
          <span class="tabular-nums">出勤延べ <strong class="text-slate-900">{{ weekShiftCountFor(g.store.id) }}</strong> 件</span>
          <span v-if="holidayCountFor(g.store.id) > 0" class="text-red-700 tabular-nums">
            休業 {{ holidayCountFor(g.store.id) }} 日
          </span>
        </span>
      </button>

      <template v-if="!isCollapsed(g.store.id)">
        <!-- 曜日ヘッダー行 -->
        <div class="grid grid-cols-[140px_repeat(7,1fr)] border-b border-[#dcdcde] bg-[#f6f7f7]">
          <div class="px-2 py-1.5 text-xs font-semibold text-slate-700 border-r border-[#dcdcde]">
            スタッフ
          </div>
          <div
            v-for="d in days"
            :key="d.ymd"
            class="px-2 py-1.5 text-xs font-semibold text-center border-r border-[#dcdcde] last:border-r-0"
            :class="dowColorClass(d.dayOfWeek)"
          >
            {{ d.label }} {{ d.date }}
          </div>
        </div>

        <!-- スタッフ行 -->
        <div
          v-for="row in g.rows"
          :key="row.staff.id"
          class="grid grid-cols-[140px_repeat(7,1fr)] border-b border-[#dcdcde] last:border-b-0"
        >
          <div class="px-2 py-2 text-sm font-medium text-slate-900 border-r border-[#dcdcde] flex items-center">
            {{ row.staff.name }}
          </div>
          <button
            v-for="cell in row.cells"
            :key="cell.ymd"
            type="button"
            class="px-1.5 py-2 text-xs border-r border-[#dcdcde] last:border-r-0 text-left hover:bg-[#fafbfc] transition-colors min-h-[44px] flex flex-col gap-0.5 justify-center"
            :class="cell.bgClass"
            @click="onCellClick(cell.ymd)"
          >
            <template v-if="cell.shiftTimeLabel">
              <span class="text-slate-900 font-medium tabular-nums">
                {{ cell.shiftTimeLabel }}
              </span>
              <span v-if="cell.helpLabel" class="text-[10px] text-purple-700">
                → {{ cell.helpLabel }}
              </span>
            </template>
            <span
              v-else-if="cell.emptyLabel"
              class="text-[10px]"
              :class="cell.emptyLabel.color"
            >
              {{ cell.emptyLabel.text }}
            </span>
          </button>
        </div>
      </template>
    </div>

    <p class="text-xs text-slate-500">
      セルをクリックすると、その日の日ビューに切り替わって編集できます。
    </p>
  </div>
</template>
