<script setup lang="ts">
import type { Shift, Store } from '@prisma/client'

type ShiftWithJoins = Shift & {
  practitioner: { id: number, name: string, storeId: number, displayOrder: number, store: Pick<Store, 'id' | 'name'> }
  workStore: Pick<Store, 'id' | 'name'> | null
}

const props = defineProps<{
  month: string // "YYYY-MM"
}>()

const router = useRouter()
const route = useRoute()

// その月のシフト全件を取得
const { data: shifts } = await useFetch<ShiftWithJoins[]>('/api/admin/shifts', {
  query: computed(() => ({ month: props.month })),
  watch: [() => props.month],
})

// 店舗マスタ
const { data: stores } = await useFetch<Store[]>('/api/admin/stores', {
  query: { status: 'active' },
})

function ymd(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// 折りたたみ状態（= 月ビューでは「非表示店舗」として作用）
const { isCollapsed, toggle: toggleCollapse } = useShiftStoreCollapse()

// 店舗順序（id 昇順）
const sortedStores = computed(() => (stores.value ?? []).slice().sort((a, b) => a.id - b.id))
const visibleStoreIds = computed(() => new Set(sortedStores.value.filter(s => !isCollapsed(s.id)).map(s => s.id)))

// ── 日付ごとのシフト集計 ─────────────────────────────────
// (ymd → 表示用エントリ配列)。
// 実際の勤務先 = workStoreId ?? practitioner.storeId
// 表示店舗チップで非表示の店舗のシフトは除外。
// 並び順は startTime → スタッフ displayOrder。
type ShiftEntry = {
  staffId: number
  staffName: string
  storeId: number // 実際の勤務先
  startTime: string
  endTime: string
  isHelp: boolean
}

const entriesByDate = computed<Record<string, ShiftEntry[]>>(() => {
  const map: Record<string, ShiftEntry[]> = {}
  const allowed = visibleStoreIds.value
  for (const s of shifts.value ?? []) {
    const actualStoreId = s.workStoreId ?? s.practitioner.storeId
    if (!allowed.has(actualStoreId)) continue
    const key = ymd(s.date)
    if (!map[key]) map[key] = []
    map[key].push({
      staffId: s.practitionerId,
      staffName: s.practitioner.name,
      storeId: actualStoreId,
      startTime: s.startTime,
      endTime: s.endTime,
      isHelp: s.workStoreId != null,
    })
  }
  for (const key of Object.keys(map)) {
    map[key]!.sort((a, b) => {
      if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime)
      return a.staffName.localeCompare(b.staffName, 'ja')
    })
  }
  return map
})

// 1 セルに表示する最大件数（あふれたら「他 N 名」）
const MAX_VISIBLE = 4

function onCellClick(payload: { ymd: string }) {
  router.replace({
    query: { ...route.query, view: 'day', date: payload.ymd },
  })
}
</script>

<template>
  <div>
    <!-- 表示店舗チップ（クリックで非表示／表示切替） -->
    <div
      v-if="sortedStores.length > 0"
      class="bg-white border border-[#c3c4c7] rounded-sm p-2 mb-3 flex items-center gap-2 flex-wrap"
    >
      <span class="text-xs font-semibold text-slate-700">表示店舗:</span>
      <button
        v-for="s in sortedStores"
        :key="s.id"
        type="button"
        class="px-2 py-1 text-xs rounded-sm border transition-colors"
        :class="isCollapsed(s.id)
          ? 'bg-white border-[#dcdcde] text-slate-400 line-through'
          : 'bg-orange-50 border-orange-300 text-orange-800'"
        @click="toggleCollapse(s.id)"
      >
        {{ s.name }}
      </button>
    </div>

    <CalendarMonthCalendarGrid :month="month" :cell-height-px="120" @cell-click="onCellClick">
      <template #cell="{ ymd: cellYmd, isCurrentMonth }">
        <template v-if="isCurrentMonth && (entriesByDate[cellYmd] ?? []).length > 0">
          <div class="flex flex-col gap-0.5 text-[10px] leading-tight overflow-hidden">
            <div
              v-for="entry in (entriesByDate[cellYmd] ?? []).slice(0, MAX_VISIBLE)"
              :key="entry.staffId"
              class="flex items-center gap-1 tabular-nums min-w-0"
              :class="entry.isHelp ? 'text-purple-700' : 'text-slate-700'"
              :title="`${entry.staffName} ${entry.startTime}–${entry.endTime}${entry.isHelp ? '（ヘルプ）' : ''}`"
            >
              <span class="font-medium truncate min-w-0">{{ entry.staffName }}</span>
              <span class="text-slate-500 shrink-0">{{ entry.startTime }}-{{ entry.endTime }}</span>
            </div>
            <div
              v-if="(entriesByDate[cellYmd] ?? []).length > MAX_VISIBLE"
              class="text-slate-500 text-[10px]"
            >
              他 {{ (entriesByDate[cellYmd] ?? []).length - MAX_VISIBLE }} 名
            </div>
          </div>
        </template>
      </template>
    </CalendarMonthCalendarGrid>
  </div>
</template>
