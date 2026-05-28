<script setup lang="ts">
import { displayStatus, DISPLAY_STATUS_LABEL, DISPLAY_STATUS_BADGE_CLASS, type DbStatus } from '~~/shared/reservationStatus'

definePageMeta({ layout: 'admin' })

const { user } = useUserSession()

// ヘッダーの店舗スイッチャーで選択中の店舗。null = 全店舗
const { selectedStoreId } = useStoreContext()

type RevenueBucket = {
  storeId: number
  storeName: string
  menu: number
  sale: number
  total: number
}

type Summary = {
  stores: number
  beds: number
  staff: number
  menus: number
  holidaysFuture: number
  todayReservations: number
  weekReservations: number
  upcomingConfirmed: number
  revenueToday: RevenueBucket[]
  revenueThisMonth: RevenueBucket[]
}

// 本日の予約明細（予約一覧 API を from=今日&to=今日 で流用。スキーマ変更なし）
type TodayReservation = {
  id: number
  status: DbStatus
  confirmationCode: string
  startAt: string
  endAt: string
  store: { id: number, name: string }
  bed: { id: number, name: string }
  staff: { id: number, name: string }
  menu: { id: number, name: string, durationMinutes: number, priceJpy: number }
  customer: { id: number, name: string | null }
}
type ReservationListResponse = { items: TodayReservation[], total: number }

function pad(n: number): string { return String(n).padStart(2, '0') }
function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function yen(n: number): string { return n.toLocaleString('ja-JP') }

const today = todayYmd()

// 概要（件数・売上）
const { data: summary, error } = await useFetch<Summary>('/api/admin/dashboard/summary', {
  query: computed(() => ({ storeId: selectedStoreId.value ?? '' })),
  watch: [selectedStoreId],
})

// 本日の予約一覧（主役テーブル用）。件数は多くないので pageSize=100 で十分
const { data: todayRes, error: todayResError } = await useFetch<ReservationListResponse>('/api/admin/reservations', {
  query: computed(() => ({ from: today, to: today, pageSize: 100, storeId: selectedStoreId.value ?? '' })),
  watch: [selectedStoreId],
})

// キャンセルを除き、開始時刻の昇順で並べる
const todayReservations = computed(() =>
  (todayRes.value?.items ?? [])
    .filter(r => r.status !== 'CANCELLED')
    .sort((a, b) => a.startAt.localeCompare(b.startAt)),
)

// 本日日付の表示（YYYY/MM/DD（曜））
const todayLabel = computed(() => {
  const d = new Date()
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}（${w}）`
})

// KPI（予約系）。リンク先のクエリは従来のダッシュボードと同じ
const reservationKpis = computed(() => [
  { label: '本日の予約', value: summary.value?.todayReservations ?? 0, to: `/dashboard/reservations?from=${today}&to=${today}&status=CONFIRMED` },
  { label: '今週の予約', value: summary.value?.weekReservations ?? 0, to: '/dashboard/reservations?status=CONFIRMED' },
  { label: '今後の確定', value: summary.value?.upcomingConfirmed ?? 0, to: '/dashboard/reservations?status=CONFIRMED' },
])

// 運営マスタ件数（右カラムに小さく残す）
const masterLinks = computed(() => [
  { label: '店舗', value: summary.value?.stores ?? 0, to: '/dashboard/stores' },
  { label: 'ベッド', value: summary.value?.beds ?? 0, to: '/dashboard/stores' },
  { label: 'スタッフ', value: summary.value?.staff ?? 0, to: '/dashboard/staff' },
  { label: 'メニュー', value: summary.value?.menus ?? 0, to: '/dashboard/menus' },
])

const monthTotal = computed(() => (summary.value?.revenueThisMonth ?? []).reduce((s, b) => s + b.total, 0))
const todayTotal = computed(() => (summary.value?.revenueToday ?? []).reduce((s, b) => s + b.total, 0))

// ステータスバッジ（予約一覧ページと同じ表示ロジック）
function badge(r: TodayReservation) {
  const s = displayStatus(r.status, r.endAt)
  return { label: DISPLAY_STATUS_LABEL[s], class: DISPLAY_STATUS_BADGE_CLASS[s] }
}
</script>

<template>
  <div>
    <!-- 見出し行 -->
    <div class="flex items-end justify-between mb-4">
      <div>
        <h1 class="text-xl font-bold text-slate-900">
          ダッシュボード
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">
          ようこそ、{{ user?.displayName ?? user?.username ?? '' }} さん
        </p>
      </div>
      <p class="text-sm text-slate-600 tabular-nums">
        本日 {{ todayLabel }}
      </p>
    </div>

    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`概要の取得に失敗しました: ${error.message}`"
      class="mb-4"
    />

    <!-- KPI ストリップ -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
      <NuxtLink
        v-for="k in reservationKpis"
        :key="k.label"
        :to="k.to"
        class="bg-white border border-slate-200 rounded-md px-4 py-3 hover:border-orange-400 transition-colors block"
      >
        <p class="text-xs text-slate-500">
          {{ k.label }}
        </p>
        <p class="text-2xl font-bold text-orange-600 tabular-nums mt-0.5">
          {{ k.value }}
        </p>
      </NuxtLink>
      <template v-if="hasPermission('sale:view')">
        <NuxtLink
          to="/dashboard/sales"
          class="bg-white border border-slate-200 rounded-md px-4 py-3 hover:border-orange-400 transition-colors block"
        >
          <p class="text-xs text-slate-500">
            本日の売上
          </p>
          <p class="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
            ¥{{ yen(todayTotal) }}
          </p>
        </NuxtLink>
        <NuxtLink
          to="/dashboard/sales"
          class="bg-white border border-slate-200 rounded-md px-4 py-3 hover:border-orange-400 transition-colors block"
        >
          <p class="text-xs text-slate-500">
            今月の売上
          </p>
          <p class="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
            ¥{{ yen(monthTotal) }}
          </p>
        </NuxtLink>
      </template>
    </div>

    <!-- 主役: 本日の予約一覧 -->
    <section class="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden mb-5">
      <div class="flex items-center justify-between bg-orange-50 border-b border-slate-200 px-4 py-2.5">
        <h2 class="text-sm font-semibold text-slate-800">
          本日の予約
        </h2>
        <span class="text-xs text-slate-600 tabular-nums">{{ todayReservations.length }} 件</span>
      </div>

      <UAlert
        v-if="todayResError"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="`本日の予約の取得に失敗しました: ${todayResError.message}`"
        class="m-4"
      />

      <div v-else-if="todayReservations.length === 0" class="px-4 py-12 text-center text-sm text-slate-400">
        本日の予約はありません
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th class="px-3 py-2 text-left font-medium border-b border-slate-200 w-32">
                時間
              </th>
              <th class="px-3 py-2 text-left font-medium border-b border-slate-200">
                店舗
              </th>
              <th class="px-3 py-2 text-left font-medium border-b border-slate-200">
                お客様
              </th>
              <th class="px-3 py-2 text-left font-medium border-b border-slate-200">
                メニュー
              </th>
              <th class="px-3 py-2 text-left font-medium border-b border-slate-200">
                担当 / ベッド
              </th>
              <th class="px-3 py-2 text-left font-medium border-b border-slate-200 w-28">
                状態
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in todayReservations"
              :key="r.id"
              class="border-b border-slate-100 last:border-0 hover:bg-orange-50/40"
            >
              <td class="px-3 py-2.5 tabular-nums whitespace-nowrap font-medium text-slate-900">
                {{ fmtJstTime(r.startAt) }}–{{ fmtJstTime(r.endAt) }}
              </td>
              <td class="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                {{ r.store.name }}
              </td>
              <td class="px-3 py-2.5">
                <NuxtLink :to="`/dashboard/customers/${r.customer.id}`" class="text-orange-700 hover:underline">
                  {{ r.customer.name ?? '(未登録)' }}
                </NuxtLink>
              </td>
              <td class="px-3 py-2.5 text-slate-700">
                {{ r.menu.name }}
              </td>
              <td class="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                {{ r.staff.name }} / {{ r.bed.name }}
              </td>
              <td class="px-3 py-2.5">
                <span class="inline-block px-2 py-0.5 rounded border text-xs" :class="badge(r).class">
                  {{ badge(r).label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 下部: 売上 + クイックリンク/運営マスタ -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- 売上（店舗別） -->
      <section v-if="hasPermission('sale:view')" class="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
        <div class="bg-orange-50 border-b border-slate-200 px-4 py-2.5">
          <h2 class="text-sm font-semibold text-slate-800">
            売上（店舗別）
          </h2>
        </div>
        <div class="p-4 space-y-4">
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-slate-500">本日</span>
              <span class="text-base font-bold text-slate-900 tabular-nums">¥{{ yen(todayTotal) }}</span>
            </div>
            <ul class="text-sm divide-y divide-slate-100">
              <li v-for="b in summary?.revenueToday ?? []" :key="b.storeId" class="flex items-center justify-between gap-2 py-1">
                <span class="text-slate-700">{{ b.storeName }}</span>
                <span class="text-xs text-slate-500 tabular-nums">施術 ¥{{ yen(b.menu) }} / 物販 ¥{{ yen(b.sale) }}</span>
                <span class="font-semibold text-slate-900 tabular-nums">¥{{ yen(b.total) }}</span>
              </li>
            </ul>
          </div>
          <div class="border-t border-slate-200 pt-3">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-slate-500">今月</span>
              <span class="text-base font-bold text-slate-900 tabular-nums">¥{{ yen(monthTotal) }}</span>
            </div>
            <ul class="text-sm divide-y divide-slate-100">
              <li v-for="b in summary?.revenueThisMonth ?? []" :key="b.storeId" class="flex items-center justify-between gap-2 py-1">
                <span class="text-slate-700">{{ b.storeName }}</span>
                <span class="text-xs text-slate-500 tabular-nums">施術 ¥{{ yen(b.menu) }} / 物販 ¥{{ yen(b.sale) }}</span>
                <span class="font-semibold text-slate-900 tabular-nums">¥{{ yen(b.total) }}</span>
              </li>
            </ul>
            <p class="text-xs text-slate-400 mt-2">
              ※ 回数券は購入日に計上、消費日は売上ゼロ
            </p>
          </div>
        </div>
      </section>

      <!-- クイックリンク + 運営マスタ件数 -->
      <section class="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
        <div class="bg-orange-50 border-b border-slate-200 px-4 py-2.5">
          <h2 class="text-sm font-semibold text-slate-800">
            クイックリンク
          </h2>
        </div>
        <div class="p-4">
          <ul class="space-y-2 text-sm">
            <li>
              <NuxtLink to="/dashboard/reservations/new" class="text-orange-700 hover:underline">
                ＋ 予約を手動で追加
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/dashboard/reservations" class="text-orange-700 hover:underline">
                予約一覧を見る
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/dashboard/shifts" class="text-orange-700 hover:underline">
                本日のシフトを編集
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/dashboard/staff/new" class="text-orange-700 hover:underline">
                ＋ 新しいスタッフを追加
              </NuxtLink>
            </li>
          </ul>

          <!-- 運営マスタ件数 -->
          <div class="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-200">
            <NuxtLink
              v-for="m in masterLinks"
              :key="m.label"
              :to="m.to"
              class="text-center rounded-md border border-slate-200 py-2 hover:border-orange-400 transition-colors"
            >
              <p class="text-[11px] text-slate-500">
                {{ m.label }}
              </p>
              <p class="text-lg font-bold text-slate-900 tabular-nums">
                {{ m.value }}
              </p>
            </NuxtLink>
          </div>

          <p class="text-xs text-slate-400 mt-3">
            今後の店休日 {{ summary?.holidaysFuture ?? 0 }} 件 / 今後の確定予約 {{ summary?.upcomingConfirmed ?? 0 }} 件
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
