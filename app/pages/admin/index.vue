<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const { user } = useUserSession()

type Summary = {
  stores: number
  beds: number
  staff: number
  menus: number
  holidaysFuture: number
}

const { data: summary, error } = await useFetch<Summary>('/api/admin/dashboard/summary')

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

    <!-- WP 風ウィジェット 4 枚 -->
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
            <NuxtLink to="/admin/stores/new" class="text-blue-700 hover:text-blue-900 hover:underline">
              + 新しい店舗を追加
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/admin/staff/new" class="text-blue-700 hover:text-blue-900 hover:underline">
              + 新しいスタッフを追加
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/admin/shifts" class="text-blue-700 hover:text-blue-900 hover:underline">
              本日のシフトを編集
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/admin/schedule" class="text-blue-700 hover:text-blue-900 hover:underline">
              営業時間 / 店休日を編集
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
          <li class="text-xs text-slate-500 pt-2 border-t border-[#dcdcde]">
            予約管理 / 予約一覧は <strong>Phase 4</strong> で追加予定です。
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
