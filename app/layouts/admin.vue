<script setup lang="ts">
// WordPress 風管理画面レイアウト。
// 上部 admin bar（黒紺帯、高さ 32px）+ 左サイドバー（黒紺、幅 180px）+ メイン（白背景）。
const { user, fetch: fetchSession, clear: clearSession } = useUserSession()

// ナビ定義。フラット展開（店舗管理の下に各エンティティを並列）
const navItems = [
  { icon: 'i-lucide-home', label: 'ダッシュボード', to: '/admin' },
  { icon: 'i-lucide-building-2', label: '店舗管理', to: '/admin/stores' },
  { icon: 'i-lucide-bed-double', label: 'ベッド管理', to: '/admin/beds' },
  { icon: 'i-lucide-user-round', label: '施術者管理', to: '/admin/practitioners' },
  { icon: 'i-lucide-clipboard-list', label: 'メニュー管理', to: '/admin/menus' },
  { icon: 'i-lucide-clock', label: '営業時間', to: '/admin/business-hours' },
  { icon: 'i-lucide-calendar-x', label: '店休日', to: '/admin/holidays' },
] as const

const route = useRoute()
function isActive(to: string) {
  // /admin だけは完全一致、それ以外は前方一致でアクティブ判定
  if (to === '/admin') return route.path === '/admin'
  return route.path === to || route.path.startsWith(`${to}/`)
}

async function logout() {
  await $fetch('/api/admin/logout', { method: 'POST' })
  await fetchSession()
  clearSession()
  await navigateTo('/admin/login', { replace: true })
}
</script>

<template>
  <div class="min-h-screen bg-[#f0f0f1] text-slate-900">
    <!-- WordPress 風 admin bar -->
    <header class="fixed top-0 inset-x-0 h-8 bg-[#1d2327] text-[#c3c4c7] flex items-center justify-between px-3 text-xs z-30">
      <div class="flex items-center gap-3">
        <NuxtLink to="/admin" class="font-semibold text-white hover:text-orange-400">
          honeking 管理
        </NuxtLink>
        <NuxtLink to="/" class="hover:text-orange-400" target="_blank">
          サイトを表示
        </NuxtLink>
      </div>
      <div class="flex items-center gap-3">
        <span>こんにちは、<span class="text-white font-medium">{{ user?.username ?? '' }}</span> さん</span>
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
