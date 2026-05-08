<script setup lang="ts">
import type { Shift, Store } from '@prisma/client'

type ShiftWithJoins = Shift & {
  practitioner: { id: number, name: string, storeId: number, store: Pick<Store, 'id' | 'name'> }
  workStore: Pick<Store, 'id' | 'name'> | null
}

const props = defineProps<{
  month: string // "YYYY-MM"
}>()

const router = useRouter()
const route = useRoute()

// その月のシフト全件を取得
const { data: shifts } = await useFetch<ShiftWithJoins[]>('/api/admin/shifts', {
  query: { month: () => props.month },
  watch: [() => props.month],
})

// アクティブ店舗（出勤人数の集計に使う）
const { data: stores } = await useFetch<Store[]>('/api/admin/stores', {
  query: { status: 'active' },
})

// ── 日付ごとの集計 ─────────────────────────────────────
type DaySummary = {
  ymd: string
  byStore: Record<number, number> // storeId → その日に勤務するスタッフ数（メイン+ヘルプ受入）
  helpInCount: number // この日のヘルプ勤務件数
  total: number
}

function ymd(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const summaryByDate = computed<Record<string, DaySummary>>(() => {
  const map: Record<string, DaySummary> = {}
  for (const s of shifts.value ?? []) {
    const key = ymd(s.date)
    if (!map[key]) {
      map[key] = { ymd: key, byStore: {}, helpInCount: 0, total: 0 }
    }
    // 実際の勤務先 = workStoreId があればそれ、無ければメイン所属
    const actualStoreId = s.workStoreId ?? s.practitioner.storeId
    map[key].byStore[actualStoreId] = (map[key].byStore[actualStoreId] ?? 0) + 1
    if (s.workStoreId != null) map[key].helpInCount += 1
    map[key].total += 1
  }
  return map
})

// ── 日付クリック → 日ビューへ遷移 ─────────────────────
function onCellClick(payload: { ymd: string }) {
  router.replace({
    query: { ...route.query, view: 'day', date: payload.ymd },
  })
}

// 店舗順序を保持（id 昇順）
const sortedStores = computed(() => (stores.value ?? []).slice().sort((a, b) => a.id - b.id))
</script>

<template>
  <div>
    <MonthCalendarGrid :month="month" @cell-click="onCellClick">
      <template #cell="{ ymd: cellYmd, isCurrentMonth }">
        <template v-if="isCurrentMonth && summaryByDate[cellYmd]">
          <!-- 店舗ごとの出勤人数 -->
          <div class="flex flex-col gap-0.5 text-[10px] leading-tight">
            <div
              v-for="store in sortedStores"
              :key="store.id"
              class="flex items-center gap-1 truncate"
            >
              <span
                v-if="(summaryByDate[cellYmd]?.byStore[store.id] ?? 0) > 0"
                class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-sm bg-orange-50 text-orange-800 border border-orange-200 tabular-nums"
              >
                {{ store.name.length > 6 ? store.name.slice(0, 5) + '…' : store.name }}
                {{ summaryByDate[cellYmd]?.byStore[store.id] }}
              </span>
            </div>
            <div
              v-if="(summaryByDate[cellYmd]?.helpInCount ?? 0) > 0"
              class="inline-flex items-center gap-0.5 self-start px-1 py-0.5 rounded-sm bg-purple-50 text-purple-800 border border-purple-200 tabular-nums"
            >
              ヘルプ {{ summaryByDate[cellYmd]?.helpInCount }}
            </div>
          </div>
        </template>
      </template>
    </MonthCalendarGrid>
  </div>
</template>
