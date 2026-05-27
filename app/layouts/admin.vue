<script setup lang="ts">
// 管理画面 全ページ共通レイアウト（salonboard 風）。
// 白地ヘッダー + 横タブナビ、サイドバーなし、白〜薄グレーの本体。
// オレンジは「選択中タブ・ロゴ・hover」のアクセントだけに使い、地は中立なグレー系で目に優しく。
import type { Permission } from '~~/shared/permissions'
import { ROLE_LABEL } from '~~/shared/permissions'

const { user, fetch: fetchSession, clear: clearSession } = useUserSession()

// 現在の店舗コンテキスト（ヘッダーの店舗スイッチャー）。OWNER=全店/各店、それ以外=自店固定
const { stores, canAccessAll, selectedStoreId, selectedStoreName, setStore } = useStoreContext()

// 管理画面共通のタイトル・モノクロファビコン
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

// ナビ定義。横タブに収めるためラベルは短縮。各項目に必要 permission を紐付けてフィルタする。
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
  // ヘルプはタブには出さず、右端 ▼ のアカウントメニューに含める
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
    <header class="relative z-20 bg-gradient-to-b from-white to-slate-50 border-b-2 border-orange-500 text-slate-800">
      <!-- PC グリッド相当: 左にロゴ(2段ぶん・縦中央) / 右上=店舗スイッチャー / 右下=タブ -->
      <div class="flex items-stretch gap-6 px-4 max-w-7xl mx-auto">
        <!-- ロゴ: 左・縦中央。クリックでダッシュボードに戻る入口 -->
        <NuxtLink to="/dashboard" class="group flex shrink-0 items-center gap-2.5">
          <img :src="logoUrl" alt="ほねキング整骨院" class="size-12 object-contain">
          <span class="leading-tight">
            <span class="block text-xl font-bold tracking-wide text-slate-800 transition-colors group-hover:text-orange-600">
              ほねキング整骨院
            </span>
            <span class="block text-base font-bold text-orange-600">
              ダッシュボード
            </span>
          </span>
        </NuxtLink>

        <!-- 右カラム: 上=店舗スイッチャー / 下=タブ -->
        <div class="flex min-w-0 flex-1 flex-col">
          <!-- 上段: 店舗スイッチャー（OWNER は全店/各店、それ以外は自店固定ラベル）。右寄せ（salonboard の店舗名位置） -->
          <div class="flex h-10 items-center justify-end">
            <!-- store-switcher: 「今どの店舗を見ているか」の重要表示。指示しやすいよう固有クラスを付与（背景なし） -->
            <div v-if="canAccessAll" class="store-switcher group relative shrink-0">
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-base transition-colors"
              >
                <UIcon :name="selectedStoreId === null ? 'i-lucide-layout-grid' : 'i-lucide-store'" class="size-4 text-orange-600" />
                <span class="font-bold text-orange-700 whitespace-nowrap">{{ selectedStoreName }}</span>
                <UIcon name="i-lucide-chevron-down" class="size-4 text-orange-500" />
              </button>
              <div class="absolute right-0 top-full z-50 hidden min-w-44 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg group-hover:block group-focus-within:block">
                <button
                  type="button"
                  class="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-sm transition-colors hover:bg-orange-50"
                  :class="selectedStoreId === null ? 'font-semibold text-orange-700' : 'text-slate-700'"
                  @click="setStore(null)"
                >
                  <UIcon name="i-lucide-layout-grid" class="size-4 flex-shrink-0" />
                  管理者
                </button>
                <button
                  v-for="s in stores"
                  :key="s.id"
                  type="button"
                  class="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-sm transition-colors hover:bg-orange-50"
                  :class="selectedStoreId === s.id ? 'font-semibold text-orange-700' : 'text-slate-700'"
                  @click="setStore(s.id)"
                >
                  <UIcon name="i-lucide-store" class="size-4 flex-shrink-0" />
                  {{ s.name }}
                </button>
              </div>
            </div>
            <div v-else class="store-switcher flex shrink-0 items-center gap-1.5 px-2 py-1.5 text-base">
              <UIcon name="i-lucide-store" class="size-4 text-orange-600" />
              <span class="font-bold text-orange-700 whitespace-nowrap">{{ selectedStoreName }}</span>
            </div>
          </div>

          <!-- 下段: タブ + アカウント▼。-ml-1 でスイッチャーの下に内容を揃えつつ少し左へ -->
          <div class="-ml-1 flex items-stretch">
            <!-- 横タブ（非選択=グレー地+オレンジ文字 / ホバー・選択中=オレンジ塗り+白文字。底辺に揃えてタブバーらしく） -->
            <nav class="flex flex-1 items-end gap-1 overflow-x-auto">
              <NuxtLink
                v-for="item in navItems"
                :key="item.to"
                :to="item.to"
                class="flex items-center gap-1.5 rounded-t-md border-x border-t px-3.5 py-2 text-sm font-bold whitespace-nowrap transition-colors"
                :class="isActive(item.to)
                  ? 'border-orange-500 bg-gradient-to-b from-orange-500 to-orange-600 text-white shadow-sm'
                  : 'border-orange-500 bg-gradient-to-b from-slate-50 to-slate-200 text-orange-600 hover:from-orange-500 hover:to-orange-600 hover:text-white'"
              >
                <UIcon :name="item.icon" class="size-4 flex-shrink-0" />
                {{ item.label }}
              </NuxtLink>
            </nav>

            <!-- 右端: アカウントメニュー（▼）。タブと同じ見た目の小ボタン。中にアカウント情報 + サイト表示 + ログアウトを集約 -->
            <div class="group relative flex shrink-0 items-end pl-1">
              <button
                type="button"
                class="flex items-center rounded-t-md bg-slate-100 px-3 py-2 text-orange-600 transition-colors group-hover:bg-orange-600 group-hover:text-white group-focus-within:bg-orange-600 group-focus-within:text-white"
                aria-label="アカウントメニュー"
              >
                <UIcon name="i-lucide-chevron-down" class="size-4" />
              </button>
              <div class="absolute right-0 top-full z-50 hidden min-w-48 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg group-hover:block group-focus-within:block">
                <!-- アカウント情報（名前 + 役職） -->
                <div class="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2.5 text-sm">
                  <span class="font-medium text-slate-800">{{ user?.displayName ?? user?.username ?? '' }} さん</span>
                  <span v-if="userRoleLabel" class="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                    {{ userRoleLabel }}
                  </span>
                </div>
                <a
                  :href="customerSiteUrl"
                  class="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-orange-50 hover:text-orange-700"
                  target="_blank"
                  rel="noopener"
                >
                  <UIcon name="i-lucide-external-link" class="size-4 flex-shrink-0" />
                  サイトを表示
                </a>
                <NuxtLink
                  to="/dashboard/help"
                  class="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-orange-50 hover:text-orange-700"
                >
                  <UIcon name="i-lucide-circle-help" class="size-4 flex-shrink-0" />
                  ヘルプ
                </NuxtLink>
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
        </div>
      </div>
    </header>

    <!-- メイン領域 -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <slot />
    </main>
  </div>
</template>
