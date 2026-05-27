<script setup lang="ts">
// salonboard（ホットペッパービューティーのサロン管理ツール）に寄せた管理画面レイアウト。
// 上部に白地ヘッダー + 横タブナビ、サイドバーなし、白〜薄グレーの本体。
// オレンジは「選択中タブ・ロゴ・hover」のアクセントだけに使い、地は中立なグレー系で目に優しく。
// いったん /dashboard トップ専用。形が固まったら全 admin ページへ横展開（admin.vue を置き換え）予定。
import type { Permission } from '~~/shared/permissions'
import { ROLE_LABEL } from '~~/shared/permissions'

const { user, fetch: fetchSession, clear: clearSession } = useUserSession()

// 管理画面共通のタイトル・モノクロファビコン（admin.vue と同じ指定に揃える）
useHead({
  titleTemplate: title => title ? `${title} | ほねキング整骨院 管理画面` : 'ほねキング整骨院 管理画面',
  link: [
    { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/admin-favicon-32.png' },
    { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/admin-favicon-32.png' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/admin-favicon-180.png' },
  ],
})

// ロゴ画像（public/honeking-logo-180.png）。
// 静的 src="/..." だと Vite がビルド時 import に変換しようとしてコケるため、
// :src でランタイム URL として渡し public 配下を素直に取得する（StaffLoginForm と同方針）。
const logoUrl = '/honeking-logo-180.png'

// 「サイトを表示」リンク用に admin.* ホストから reserve.* ホストの URL を組み立てる
const requestUrl = useRequestURL()
const customerSiteUrl = computed(() => {
  const customerHost = requestUrl.hostname.replace(/^admin\./, 'reserve.')
  return `${requestUrl.protocol}//${customerHost}${requestUrl.port ? `:${requestUrl.port}` : ''}/`
})

// ナビ定義（admin.vue と同一の icon / to / permission。横タブに収めるためラベルだけ短縮）。
// permission が null の項目（ヘルプ）は全員に表示する。
const allNavItems: ReadonlyArray<{ icon: string, label: string, to: string, permission: Permission | null }> = [
  // ダッシュボードはロゴクリックで戻れるため、タブには出さない
  { icon: 'i-lucide-calendar-check', label: '予約・販売', to: '/dashboard/reservations', permission: 'reservation:view' },
  { icon: 'i-lucide-users', label: '顧客', to: '/dashboard/customers', permission: 'customer:view' },
  { icon: 'i-lucide-calendar-clock', label: 'シフト', to: '/dashboard/shifts', permission: 'shift:view' },
  { icon: 'i-lucide-building-2', label: '店舗', to: '/dashboard/stores', permission: 'store:view' },
  { icon: 'i-lucide-user-round', label: 'スタッフ', to: '/dashboard/staff', permission: 'staff:view' },
  { icon: 'i-lucide-clipboard-list', label: 'メニュー', to: '/dashboard/menus', permission: 'menu:view' },
  { icon: 'i-lucide-package', label: '商品', to: '/dashboard/products', permission: 'product:view' },
  { icon: 'i-lucide-trending-up', label: '売上', to: '/dashboard/sales', permission: 'sale:view' },
  { icon: 'i-lucide-circle-help', label: 'ヘルプ', to: '/dashboard/help', permission: null },
]

const navItems = computed(() => {
  const perms = user.value?.permissions ?? []
  return allNavItems.filter(item => item.permission === null || perms.includes(item.permission))
})

const userRoleLabel = computed(() => {
  const role = user.value?.role
  return role ? ROLE_LABEL[role] : ''
})

const route = useRoute()
function isActive(to: string) {
  // /dashboard だけは完全一致、それ以外は前方一致でアクティブ判定
  if (to === '/dashboard') return route.path === '/dashboard'
  return route.path === to || route.path.startsWith(`${to}/`)
}

async function logout() {
  await $fetch('/api/admin/logout', { method: 'POST' })
  await fetchSession()
  clearSession()
  await navigateTo('/login', { replace: true })
}
</script>

<template>
  <div class="min-h-screen bg-[#f7f8fa] text-slate-900">
    <!-- 上段: 白地ヘッダー（ロゴ + アカウント）。境界線で本体と分ける -->
    <!-- relative z-20: 右端ドロップダウンを本体コンテンツより前面に出すための重ね順 -->
    <header class="relative z-20 bg-white border-b border-slate-200 text-slate-800">
      <div class="flex items-center justify-between px-4 h-14 max-w-7xl mx-auto">
        <!-- ロゴ: 白地ヘッダーなのでバッジなしで直接表示。クリックでダッシュボードに戻る入口 -->
        <NuxtLink to="/dashboard" class="group flex items-center gap-2.5">
          <img :src="logoUrl" alt="ほねキング整骨院" class="size-9 object-contain">
          <span class="leading-tight">
            <span class="block text-sm font-bold tracking-wide text-slate-800 transition-colors group-hover:text-orange-600">
              ほねキング整骨院
            </span>
            <span class="block text-[10px] font-medium text-slate-400">
              ダッシュボード
            </span>
          </span>
        </NuxtLink>
        <!-- ログイン中アカウント（salonboard の店舗名位置。名前 + 役職バッジ。操作系は下段▼へ） -->
        <div class="flex items-center gap-1.5 text-xs text-slate-500">
          <span class="flex size-6 items-center justify-center rounded-full bg-orange-100">
            <UIcon name="i-lucide-user-round" class="size-3.5 text-orange-600" />
          </span>
          <span><span class="font-medium text-slate-800">{{ user?.displayName ?? user?.username ?? '' }}</span> さん</span>
          <span v-if="userRoleLabel" class="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
            {{ userRoleLabel }}
          </span>
        </div>
      </div>

      <!-- 下段: タブ + 右端アカウントメニュー。タブは塗りつぶしの角丸タブ（salonboard 風） -->
      <div class="max-w-7xl mx-auto flex items-stretch">
        <!-- 横タブ（非選択=グレー / 選択中=オレンジ塗り。底辺に揃えてタブバーらしく） -->
        <nav class="flex flex-1 items-end gap-1 px-3 overflow-x-auto">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-1.5 px-3.5 py-2 text-sm whitespace-nowrap rounded-t-md transition-colors"
            :class="isActive(item.to)
              ? 'bg-orange-600 text-white font-semibold'
              : 'bg-slate-100 text-orange-600 hover:bg-orange-600 hover:text-white'"
          >
            <UIcon :name="item.icon" class="size-4 flex-shrink-0" />
            {{ item.label }}
          </NuxtLink>
        </nav>

        <!-- 右端: アカウントメニュー（▼）。ホバー/フォーカスでサイト表示・ログアウトを表示 -->
        <div class="group relative flex shrink-0 items-end pl-1 pr-3">
          <button
            type="button"
            class="flex items-center rounded-t-md bg-slate-100 px-2.5 py-2 text-orange-600 transition-colors group-hover:bg-orange-600 group-hover:text-white group-focus-within:bg-orange-600 group-focus-within:text-white"
            aria-label="アカウントメニュー"
          >
            <UIcon name="i-lucide-chevron-down" class="size-4" />
          </button>
          <!-- ドロップダウン本体（DOM 上は group の子なので、メニュー上ホバーでも開いたまま） -->
          <div class="absolute right-3 top-full z-50 hidden min-w-48 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg group-hover:block group-focus-within:block">
            <a
              :href="customerSiteUrl"
              class="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-orange-50 hover:text-orange-700"
              target="_blank"
              rel="noopener"
            >
              <UIcon name="i-lucide-external-link" class="size-4 flex-shrink-0" />
              サイトを表示
            </a>
            <button
              type="button"
              class="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-orange-50 hover:text-orange-700"
              @click="logout"
            >
              <UIcon name="i-lucide-log-out" class="size-4 flex-shrink-0" />
              ログアウト
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- メイン領域 -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <slot />
    </main>
  </div>
</template>
