<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const url = useRequestURL()
// admin.* ホスト or /admin パス配下なら admin 文脈とみなす
const isAdminContext = computed(() => {
  return url.hostname.startsWith('admin.') || (props.error?.url ?? url.pathname).startsWith('/admin')
})

const statusCode = computed(() => props.error?.statusCode ?? 404)
const isNotFound = computed(() => statusCode.value === 404)
const isServerError = computed(() => statusCode.value >= 500)

const heading = computed(() => {
  if (isNotFound.value) return 'ページが見つかりません'
  if (isServerError.value) return 'サーバーエラーが発生しました'
  return 'エラーが発生しました'
})

const description = computed(() => {
  if (isNotFound.value) {
    return 'お探しのページは削除されたか、URL が変更された可能性があります。'
  }
  if (isServerError.value) {
    return '一時的な問題が発生しています。しばらく経ってから再度お試しください。'
  }
  return 'リクエストの処理中に問題が発生しました。'
})

const homeHref = computed(() => (isAdminContext.value ? '/admin' : '/'))
const homeLabel = computed(() => (isAdminContext.value ? '管理画面トップへ' : 'サイトトップへ戻る'))

async function handleHome() {
  // error 状態をクリアしてからナビゲート（Nuxt 公式の作法）
  await clearError({ redirect: homeHref.value })
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-white">
    <!-- ヘッダー（admin/reserve で見た目を切替） -->
    <header
      v-if="!isAdminContext"
      class="bg-[#fff3db] border-b-4 border-amber-300"
    >
      <div class="mx-auto max-w-5xl px-4 sm:px-6 py-3 flex items-center">
        <NuxtLink to="/" class="flex items-center gap-3 hover:opacity-80 transition">
          <img
            src="https://honeking.jp/wp/wp-content/themes/honeking/assets/img/common/header-logo.svg"
            alt="ほねキング整骨院"
            class="h-10 sm:h-12 w-auto"
          />
          <span class="hidden sm:inline text-base sm:text-lg font-semibold text-slate-700">
            予約システム
          </span>
        </NuxtLink>
      </div>
    </header>
    <header
      v-else
      class="bg-[#1d2327] text-[#c3c4c7] flex items-center px-3 h-8 text-xs"
    >
      <span class="font-semibold text-white">honeking 管理</span>
    </header>

    <main class="flex-1 flex items-center justify-center px-4 py-12">
      <div class="w-full max-w-lg text-center">
        <div
          class="mx-auto mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full"
          :class="isAdminContext ? 'bg-slate-100' : 'bg-amber-100'"
        >
          <UIcon
            :name="isServerError ? 'i-lucide-server-crash' : 'i-lucide-search-x'"
            class="size-10"
            :class="isAdminContext ? 'text-slate-500' : 'text-amber-600'"
          />
        </div>

        <p
          class="text-6xl sm:text-7xl font-bold tracking-tight mb-2"
          :class="isAdminContext ? 'text-slate-400' : 'text-amber-400'"
        >
          {{ statusCode }}
        </p>
        <h1 class="text-xl sm:text-2xl font-semibold text-slate-800 mb-3">
          {{ heading }}
        </h1>
        <p class="text-sm text-slate-600 mb-8 leading-relaxed">
          {{ description }}
        </p>

        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            class="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-md font-semibold text-white transition"
            :class="isAdminContext
              ? 'bg-slate-700 hover:bg-slate-800'
              : 'bg-orange-500 hover:bg-orange-600'"
            @click="handleHome"
          >
            <UIcon name="i-lucide-home" class="size-4" />
            {{ homeLabel }}
          </button>
        </div>
      </div>
    </main>

    <footer
      v-if="!isAdminContext"
      class="bg-white border-t-4 border-amber-300"
    >
      <div class="mx-auto max-w-5xl px-4 sm:px-6 py-4 text-xs text-slate-600 text-center">
        © ほねキング整骨院
      </div>
    </footer>
  </div>
</template>
