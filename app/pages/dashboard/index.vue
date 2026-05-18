<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const { user } = useUserSession()

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

const { data: summary, error } = await useFetch<Summary>('/api/admin/dashboard/summary')

// 予約系（オレンジ）と運営マスタ系（青）に分けて表示
const reservationWidgets = computed(() => [
  {
    label: '今日の予約',
    value: summary.value?.todayReservations ?? 0,
    icon: 'i-lucide-calendar-check',
    to: `/admin/reservations?from=${todayYmd()}&to=${todayYmd()}&status=CONFIRMED`,
    actionLabel: '本日の一覧へ',
    accent: 'orange' as const,
  },
  {
    label: '今週の予約',
    value: summary.value?.weekReservations ?? 0,
    icon: 'i-lucide-calendar-range',
    to: '/admin/reservations?status=CONFIRMED',
    actionLabel: '予約一覧へ',
    accent: 'orange' as const,
  },
  {
    label: '今後の予約 (確定)',
    value: summary.value?.upcomingConfirmed ?? 0,
    icon: 'i-lucide-list-todo',
    to: '/admin/reservations?status=CONFIRMED',
    actionLabel: '予約一覧へ',
    accent: 'orange' as const,
  },
])

const widgets = computed(() => [
  {
    label: '有効な店舗',
    value: summary.value?.stores ?? 0,
    icon: 'i-lucide-building-2',
    to: '/admin/stores',
    actionLabel: '店舗管理へ',
  },
  {
    label: '有効なベッド',
    value: summary.value?.beds ?? 0,
    icon: 'i-lucide-bed-double',
    to: '/admin/stores',
    actionLabel: '店舗詳細から編集',
  },
  {
    label: '有効なスタッフ',
    value: summary.value?.staff ?? 0,
    icon: 'i-lucide-user-round',
    to: '/admin/staff',
    actionLabel: 'スタッフ管理へ',
  },
  {
    label: '有効なメニュー',
    value: summary.value?.menus ?? 0,
    icon: 'i-lucide-clipboard-list',
    to: '/admin/stores',
    actionLabel: '店舗詳細から編集',
  },
])

function pad(n: number): string { return String(n).padStart(2, '0') }
function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function yen(n: number): string { return n.toLocaleString('ja-JP') }

// 今月の合計売上（全店）
const monthTotal = computed(() => {
  return (summary.value?.revenueThisMonth ?? []).reduce((sum, b) => sum + b.total, 0)
})
const todayTotal = computed(() => {
  return (summary.value?.revenueToday ?? []).reduce((sum, b) => sum + b.total, 0)
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold text-slate-900 mb-2">
      ダッシュボード
    </h1>
    <p class="text-sm text-slate-700 mb-6">
      ようこそ、{{ user?.username ?? '' }} さん。
    </p>

    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`概要の取得に失敗しました: ${error.message}`"
      class="mb-4"
    />

    <!-- 売上カード（店舗別） -->
    <div v-if="hasPermission('sale:view')" class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div class="px-5 py-3 border-b border-[#dcdcde] flex items-center justify-between">
          <h2 class="text-base font-semibold text-slate-900">
            本日の売上
          </h2>
          <span class="text-xl font-bold text-slate-900 tabular-nums">
            ¥{{ yen(todayTotal) }}
          </span>
        </div>
        <ul class="p-5 space-y-1.5 text-sm">
          <li v-for="b in summary?.revenueToday ?? []" :key="b.storeId" class="flex items-baseline justify-between gap-2">
            <span class="text-slate-700">{{ b.storeName }}</span>
            <span class="text-xs text-slate-500 tabular-nums">
              施術 ¥{{ yen(b.menu) }} + 物販 ¥{{ yen(b.sale) }} =
            </span>
            <span class="font-semibold text-slate-900 tabular-nums">¥{{ yen(b.total) }}</span>
          </li>
        </ul>
      </div>

      <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div class="px-5 py-3 border-b border-[#dcdcde] flex items-center justify-between">
          <h2 class="text-base font-semibold text-slate-900">
            今月の売上
          </h2>
          <span class="text-xl font-bold text-slate-900 tabular-nums">
            ¥{{ yen(monthTotal) }}
          </span>
        </div>
        <ul class="p-5 space-y-1.5 text-sm">
          <li v-for="b in summary?.revenueThisMonth ?? []" :key="b.storeId" class="flex items-baseline justify-between gap-2">
            <span class="text-slate-700">{{ b.storeName }}</span>
            <span class="text-xs text-slate-500 tabular-nums">
              施術 ¥{{ yen(b.menu) }} + 物販 ¥{{ yen(b.sale) }} =
            </span>
            <span class="font-semibold text-slate-900 tabular-nums">¥{{ yen(b.total) }}</span>
          </li>
        </ul>
        <p class="px-5 pb-3 text-xs text-slate-500">
          ※ 回数券は購入日に計上、消費日は売上ゼロ
        </p>
      </div>
    </div>

    <!-- 予約ウィジェット（オレンジ系・目立たせる）-->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <NuxtLink
        v-for="w in reservationWidgets"
        :key="w.label"
        :to="w.to"
        class="bg-orange-50 border-2 border-orange-300 rounded-sm p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-orange-500 hover:bg-orange-100 transition-colors block"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-orange-800 mb-1 font-semibold">
              {{ w.label }}
            </p>
            <p class="text-3xl font-bold text-orange-900 tabular-nums">
              {{ w.value }}
            </p>
          </div>
          <UIcon :name="w.icon" class="size-8 text-orange-400" />
        </div>
        <p class="text-xs text-orange-700 hover:underline mt-3">
          {{ w.actionLabel }} →
        </p>
      </NuxtLink>
    </div>

    <!-- 運営マスタウィジェット 4 枚 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <NuxtLink
        v-for="w in widgets"
        :key="w.label"
        :to="w.to"
        class="bg-white border border-[#c3c4c7] rounded-sm p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-orange-500 transition-colors block"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-slate-600 mb-1">
              {{ w.label }}
            </p>
            <p class="text-3xl font-semibold text-slate-900 tabular-nums">
              {{ w.value }}
            </p>
          </div>
          <UIcon :name="w.icon" class="size-8 text-slate-400" />
        </div>
        <p class="text-xs text-blue-700 hover:underline mt-3">
          {{ w.actionLabel }} →
        </p>
      </NuxtLink>
    </div>

    <!-- 補助情報パネル（WP の "概要" に相当） -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div class="px-5 py-3 border-b border-[#dcdcde]">
          <h2 class="text-base font-semibold text-slate-900">
            クイックリンク
          </h2>
        </div>
        <ul class="p-5 space-y-2 text-sm">
          <li>
            <NuxtLink to="/admin/reservations/new" class="text-blue-700 hover:text-blue-900 hover:underline">
              + 予約を手動で追加
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/admin/reservations" class="text-blue-700 hover:text-blue-900 hover:underline">
              予約一覧を見る
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/admin/shifts" class="text-blue-700 hover:text-blue-900 hover:underline">
              本日のシフトを編集
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/admin/staff/new" class="text-blue-700 hover:text-blue-900 hover:underline">
              + 新しいスタッフを追加
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/admin/stores" class="text-blue-700 hover:text-blue-900 hover:underline">
              営業時間 / 店休日を編集（店舗詳細のタブから）
            </NuxtLink>
          </li>
        </ul>
      </div>

      <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div class="px-5 py-3 border-b border-[#dcdcde]">
          <h2 class="text-base font-semibold text-slate-900">
            状況
          </h2>
        </div>
        <ul class="p-5 space-y-2 text-sm text-slate-700">
          <li>
            今後の店休日: <strong class="text-slate-900">{{ summary?.holidaysFuture ?? 0 }}</strong> 件
          </li>
          <li>
            今後の予約 (確定): <strong class="text-slate-900">{{ summary?.upcomingConfirmed ?? 0 }}</strong> 件
          </li>
          <li class="text-xs text-slate-500 pt-2 border-t border-[#dcdcde]">
            予約フローはお客様側 <NuxtLink to="/" class="text-blue-700 hover:underline">トップ</NuxtLink> または管理画面の
            <NuxtLink to="/admin/reservations/new" class="text-blue-700 hover:underline">手動予約作成</NuxtLink> から
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
