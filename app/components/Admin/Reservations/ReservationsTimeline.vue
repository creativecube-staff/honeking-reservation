<script setup lang="ts">
// 予約のスケジュールビュー（1 日 / ベッド × 時間軸）
// 既存の TimeColumnCalendar を「読み取り専用」モードで利用。
// 表示対象: 選択店舗 × 指定日 × status=CONFIRMED（キャンセル / 無断キャンセルは見た目を惑わせるので非表示）
// クリック → 予約詳細へ遷移
import type { CalendarColumn, CalendarRange } from '../../Calendar/types'
import { displayStatus, type DbStatus } from '~~/shared/reservationStatus'

const props = defineProps<{
  storeId: number
  date: string // YYYY-MM-DD
}>()

const router = useRouter()

// ── データ取得 ─────────────────────────────────────────
type Bed = { id: number, name: string, displayOrder: number, isActive: boolean }
const { data: beds } = await useFetch<Bed[]>(() => `/api/admin/stores/${props.storeId}/beds`, {
  default: () => [] as Bed[],
  watch: [() => props.storeId],
})

type Reservation = {
  id: number
  status: DbStatus
  confirmationCode: string
  startAt: string
  endAt: string
  bed: { id: number, name: string }
  practitioner: { id: number, name: string }
  menu: { id: number, name: string, durationMinutes: number, priceJpy: number }
  customer: { id: number, name: string | null, phone: string | null, email: string | null }
}
type ListResponse = {
  items: Reservation[]
  total: number
  totalPages: number
}

const { data: list, status: listStatus, refresh } = await useFetch<ListResponse>('/api/admin/reservations', {
  query: computed(() => ({
    storeId: props.storeId,
    from: props.date,
    to: props.date,
    pageSize: 200,
  })),
  watch: [() => props.storeId, () => props.date],
})

// 表示する予約: CONFIRMED のみ（キャンセル/NO_SHOW は非表示）
const visibleReservations = computed<Reservation[]>(() =>
  (list.value?.items ?? []).filter(r => r.status === 'CONFIRMED'),
)

// 顕在化されてない件数（キャンセル等）
const hiddenCount = computed(() => {
  const total = list.value?.items.length ?? 0
  return total - visibleReservations.value.length
})

// 予約 ID → Reservation のマップ（バーの内容表示で利用）
const reservationMap = computed(() => {
  const m = new Map<number, Reservation>()
  for (const r of visibleReservations.value) m.set(r.id, r)
  return m
})

function parseReservationId(rangeId: string): number {
  return Number(rangeId.replace('reservation-', ''))
}

function getReservation(rangeId: string): Reservation | undefined {
  return reservationMap.value.get(parseReservationId(rangeId))
}

// ── columns / ranges 構築 ─────────────────────────────
const columns = computed<CalendarColumn[]>(() =>
  (beds.value ?? [])
    .filter(b => b.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
    .map(b => ({ id: b.id, label: b.name })),
)

function pad(n: number): string { return String(n).padStart(2, '0') }
function isoToHHMM(iso: string): string {
  const d = new Date(iso)
  const jst = new Date(d.getTime() + 9 * 3600_000)
  return `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`
}

const ranges = computed<CalendarRange[]>(() =>
  visibleReservations.value.map(r => ({
    id: `reservation-${r.id}`,
    columnId: r.bed.id,
    startTime: isoToHHMM(r.startAt),
    endTime: isoToHHMM(r.endAt),
  })),
)

// ── 表示ステータスごとの色（バー本体は完全な背景色のため Tailwind カラーで定義） ───
function statusColorClasses(r: Reservation): string {
  const s = displayStatus(r.status, r.endAt)
  if (s === 'UPCOMING') return 'bg-green-100 border-green-400 text-green-900'
  if (s === 'COMPLETED') return 'bg-blue-100 border-blue-400 text-blue-900'
  // CANCELLED / NO_SHOW はフィルタで除外されてるはずだが、念のためフォールバック
  return 'bg-slate-100 border-slate-300 text-slate-700'
}

// ── イベント ─────────────────────────────────────────
function onRangeClick(r: CalendarRange) {
  const id = parseReservationId(r.id)
  if (Number.isInteger(id) && id > 0) {
    router.push(`/admin/reservations/${id}`)
  }
}

defineExpose({ refresh })
</script>

<template>
  <div class="space-y-2">
    <!-- 状況 -->
    <div class="flex items-center justify-between text-xs text-slate-600">
      <div class="flex items-center gap-3">
        <span v-if="listStatus === 'pending'">読み込み中...</span>
        <template v-else>
          <span>表示中: <strong class="tabular-nums">{{ visibleReservations.length }}</strong> 件</span>
          <span v-if="hiddenCount > 0" class="text-slate-500">
            （キャンセル / 無断キャンセル {{ hiddenCount }} 件は非表示）
          </span>
        </template>
      </div>
      <!-- 凡例 -->
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1">
          <span class="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-400" />
          <span>予約済</span>
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="inline-block w-3 h-3 rounded-sm bg-blue-100 border border-blue-400" />
          <span>完了</span>
        </span>
      </div>
    </div>

    <!-- ベッドが無いとき -->
    <div
      v-if="columns.length === 0"
      class="bg-white border border-[#c3c4c7] rounded-sm p-8 text-center text-sm text-slate-500"
    >
      この店舗にはベッドが登録されていません
    </div>

    <!-- スケジュール本体 -->
    <CalendarTimeColumnCalendar
      v-else
      :ranges="ranges"
      :columns="columns"
      :hour-start="9"
      :hour-end="21"
      :hour-px="40"
      :allow-edit="false"
      bar-cursor="pointer"
      :max-ranges-per-column="null"
      empty-label="予約なし"
      @range-click="onRangeClick"
    >
      <template #bar="{ range }">
        <div
          v-if="getReservation(range.id)"
          class="absolute inset-0 rounded-sm border px-1.5 py-1 overflow-hidden pointer-events-none flex flex-col justify-start"
          :class="statusColorClasses(getReservation(range.id)!)"
        >
          <div class="text-[10px] font-semibold tabular-nums leading-tight">
            {{ range.startTime }}–{{ range.endTime }}
          </div>
          <div class="text-[11px] font-semibold leading-tight truncate">
            {{ getReservation(range.id)!.customer.name ?? '(復号失敗)' }}
          </div>
          <div class="text-[10px] leading-tight truncate opacity-80">
            {{ getReservation(range.id)!.menu.name }}
          </div>
          <div class="text-[9px] leading-tight truncate opacity-70">
            担当: {{ getReservation(range.id)!.practitioner.name }}
          </div>
        </div>
      </template>
    </CalendarTimeColumnCalendar>
  </div>
</template>
