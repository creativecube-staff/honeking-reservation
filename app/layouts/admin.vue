<script setup lang="ts">
// WordPress 風管理画面レイアウト。
// 上部 admin bar（黒紺帯、高さ 32px）+ 左サイドバー（黒紺、幅 180px）+ メイン（白背景）。
import type { Permission } from '~~/shared/permissions'
import { ROLE_LABEL } from '~~/shared/permissions'

const { user, fetch: fetchSession, clear: clearSession } = useUserSession()

// 管理画面共通のタイトル・ファビコン上書き。
// - タイトル: 各ページが useHead で上書きしない場合のデフォルト。
// - ファビコン: 実ロゴの grayscale 版 PNG を public/ から読む(管理画面はモノクロブランド)。
//
// 配置:
//   public/admin-favicon-32.png   ← 32x32 px の grayscale PNG
//   public/admin-favicon-180.png  ← 180x180 px の grayscale PNG (Apple touch icon 用)
//
// 作り方の例(Mac):
//   1. https://honeking.jp/wp/wp-content/themes/honeking/assets/img/favicon/honeking/favicon-32x32.png を保存
//   2. Preview.app で開く → 「ツール → カラーを調整 → 彩度を 0 に」→ エクスポート
//   3. public/admin-favicon-32.png として保存
//   4. apple-touch-icon.png も同じ手順で grayscale 化して public/admin-favicon-180.png に保存
//
// PNG が未配置の間は管理画面のタブにファビコンが出ない(空 or ブラウザのデフォルト)。
// 配置すれば即反映(ブラウザのキャッシュクリアが必要な場合は Cmd+Shift+R)。
useHead({
  titleTemplate: title => title ? `${title} | honeking 管理画面` : 'honeking 管理画面',
  link: [
    // nuxt.config.ts で定義したカラー版を上書き
    { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/admin-favicon-32.png' },
    { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/admin-favicon-32.png' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/admin-favicon-180.png' },
  ],
})

// 「サイトを表示」リンク用に admin.* ホストから reserve.* ホストの URL を組み立てる。
// dev: admin.honeking.localhost → reserve.honeking.localhost
// prod: admin.honeking.jp → reserve.honeking.jp
const requestUrl = useRequestURL()
const customerSiteUrl = computed(() => {
  const customerHost = requestUrl.hostname.replace(/^admin\./, 'reserve.')
  return `${requestUrl.protocol}//${customerHost}${requestUrl.port ? `:${requestUrl.port}` : ''}/`
})

// ナビ定義。各項目に必要 permission を紐付け、ユーザーの permissions でフィルタする。
// - 店舗管理: 基本情報・ベッド・特別メニュー・営業時間・店休日をタブで集約
// - スタッフ管理: 全店舗のスタッフを横断管理（メイン店舗で絞り込み）。ログイン情報・役職もここで設定
// - メニュー管理: 共通メニュー（全店舗で利用可能）の管理。店舗ごとの特別メニューは店舗詳細から
// - シフト管理: 日付別、出勤時刻 + workStoreId（人手不足時のヘルプ先指定）
// 各項目に必要 permission を紐付けてユーザーの permissions でフィルタする。
// permission が null の項目（ヘルプ等）は全員に表示する。
const allNavItems: ReadonlyArray<{ icon: string, label: string, to: string, permission: Permission | null }> = [
  { icon: 'i-lucide-home', label: 'ダッシュボード', to: '/dashboard', permission: 'dashboard:view' },
  { icon: 'i-lucide-calendar-check', label: '予約・販売管理', to: '/dashboard/reservations', permission: 'reservation:view' },
  { icon: 'i-lucide-users', label: '顧客管理', to: '/dashboard/customers', permission: 'customer:view' },
  { icon: 'i-lucide-calendar-clock', label: 'シフト管理', to: '/dashboard/shifts', permission: 'shift:view' },
  { icon: 'i-lucide-building-2', label: '店舗管理', to: '/dashboard/stores', permission: 'store:view' },
  { icon: 'i-lucide-user-round', label: 'スタッフ管理', to: '/dashboard/staff', permission: 'staff:view' },
  { icon: 'i-lucide-clipboard-list', label: 'メニュー管理', to: '/dashboard/menus', permission: 'menu:view' },
  { icon: 'i-lucide-package', label: '商品管理', to: '/dashboard/products', permission: 'product:view' },
  { icon: 'i-lucide-trending-up', label: '売上管理', to: '/dashboard/sales', permission: 'sale:view' },
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
  <div class="min-h-screen bg-[#f0f0f1] text-slate-900">
    <!-- WordPress 風 admin bar -->
    <header class="fixed top-0 inset-x-0 h-8 bg-[#1d2327] text-[#c3c4c7] flex items-center justify-between px-3 text-xs z-30">
      <div class="flex items-center gap-3">
        <NuxtLink to="/dashboard" class="font-semibold text-white hover:text-orange-400">
          honeking 管理
        </NuxtLink>
        <a :href="customerSiteUrl" class="hover:text-orange-400" target="_blank" rel="noopener">
          サイトを表示
        </a>
      </div>
      <div class="flex items-center gap-3">
        <span>
          こんにちは、<span class="text-white font-medium">{{ user?.displayName ?? user?.username ?? '' }}</span> さん
          <span v-if="userRoleLabel" class="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-[#2c3338] text-[#c3c4c7]">
            {{ userRoleLabel }}
          </span>
        </span>
        <button class="hover:text-orange-400" @click="logout">
          ログアウト
        </button>
      </div>
    </header>

    <!-- 左サイドバー -->
    <aside class="fixed top-8 bottom-0 left-0 w-[180px] bg-[#1d2327] text-[#c3c4c7] overflow-y-auto z-20">
      <nav class="py-2">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2 px-3 py-2 text-sm transition-colors"
          :class="isActive(item.to)
            ? 'bg-orange-500 text-white'
            : 'hover:bg-[#2c3338] hover:text-white'"
        >
          <UIcon :name="item.icon" class="size-4 flex-shrink-0" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>
    </aside>

    <!-- メイン領域 -->
    <main class="pt-8 pl-[180px] min-h-screen">
      <div class="p-6 sm:p-8">
        <slot />
      </div>
    </main>
  </div>
</template>
