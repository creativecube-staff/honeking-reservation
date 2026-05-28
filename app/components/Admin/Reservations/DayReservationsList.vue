<script setup lang="ts">
// シフト日ビュー下に置く「その日の予約」パネル。
// 指定日の予約を時刻順で並べ、クリックで詳細ページへ。
import { displayStatus, DISPLAY_STATUS_LABEL, type DbStatus } from '~~/shared/reservationStatus'

const props = defineProps<{
  date: string // YYYY-MM-DD
}>()

type Reservation = {
  id: number
  status: DbStatus
  confirmationCode: string
  startAt: string
  endAt: string
  store: { id: number, name: string }
  bed: { id: number, name: string }
  staff: { id: number, name: string }
  menu: { id: number, name: string, durationMinutes: number }
  customer: { id: number, name: string | null, phone: string | null, email: string | null }
}
type ListResponse = {
  items: Reservation[]
  total: number
}

const { data, status, refresh } = await useFetch<ListResponse>('/api/admin/reservations', {
  query: computed(() => ({
    from: props.date,
    to: props.date,
    pageSize: 200,
  })),
  watch: [() => props.date],
})

function pad(n: number): string { return String(n).padStart(2, '0') }
function fmtJstTime(iso: string): string {
  const d = new Date(iso)
  const jst = new Date(d.getTime() + 9 * 3600_000)
  return `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`
}

// 表示用ステータスは「DB の status + endAt」から判定する（CONFIRMED + 終了済 = 完了）
function statusBadge(r: Reservation): { label: string, class: string } {
  const s = displayStatus(r.status, r.endAt)
  const cls
    = s === 'UPCOMING' ? 'bg-green-100 text-green-800'
      : s === 'COMPLETED' ? 'bg-blue-100 text-blue-800'
        : s === 'NO_SHOW' ? 'bg-red-100 text-red-800'
          : 'bg-slate-200 text-slate-500 line-through'
  return { label: DISPLAY_STATUS_LABEL[s], class: cls }
}

// 店舗ごとにグループ化
const grouped = computed(() => {
  const map = new Map<number, { store: { id: number, name: string }, items: Reservation[] }>()
  for (const r of (data.value?.items ?? [])) {
    if (!map.has(r.store.id)) map.set(r.store.id, { store: r.store, items: [] })
    map.get(r.store.id)!.items.push(r)
  }
  return Array.from(map.values())
})

const router = useRouter()
function gotoDetail(id: number) {
  router.push(`/dashboard/reservations/${id}`)
}
</script>

<template>
  <section class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
    <div class="px-4 py-2.5 border-b border-[#dcdcde] bg-[#f6f7f7] flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-900">
        <UIcon name="i-lucide-calendar-check" class="size-4 align-text-bottom" />
        この日の予約
        <span v-if="data" class="text-slate-500 text-xs font-normal">
          ({{ data.total }} 件)
        </span>
      </h2>
      <button
        type="button"
        class="text-xs text-slate-600 hover:text-orange-700 inline-flex items-center gap-1"
        @click="refresh()"
      >
        <UIcon name="i-lucide-refresh-cw" class="size-3" />
        更新
      </button>
    </div>

    <div v-if="status === 'pending'" class="p-4 text-sm text-slate-500 text-center">
      読み込み中...
    </div>
    <div v-else-if="!data || data.items.length === 0" class="p-4 text-sm text-slate-500 text-center">
      この日の予約はまだありません
    </div>
    <div v-else class="divide-y divide-[#dcdcde]">
      <div v-for="g in grouped" :key="g.store.id">
        <h3 class="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-50">
          {{ g.store.name }} ({{ g.items.length }} 件)
        </h3>
        <ul>
          <li
            v-for="r in g.items"
            :key="r.id"
            class="px-4 py-2.5 flex items-center gap-3 hover:bg-orange-50/40 cursor-pointer border-b last:border-b-0 border-[#f0f0f0]"
            @click="gotoDetail(r.id)"
          >
            <div class="font-bold tabular-nums text-slate-900 min-w-[110px]">
              {{ fmtJstTime(r.startAt) }}–{{ fmtJstTime(r.endAt) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-slate-900 truncate">
                {{ r.customer.name ?? '(復号失敗)' }}
                <span class="text-xs text-slate-500 ml-1">{{ r.menu.name }}</span>
              </div>
              <div class="text-xs text-slate-500 truncate">
                担当: {{ r.staff.name }} / {{ r.bed.name }}
                <template v-if="r.customer.phone"> · 📞 {{ r.customer.phone }}</template>
              </div>
            </div>
            <span class="inline-block px-2 py-0.5 text-[10px] font-semibold rounded shrink-0" :class="statusBadge(r).class">
              {{ statusBadge(r).label }}
            </span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
