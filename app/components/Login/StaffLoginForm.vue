<script setup lang="ts">
// スタッフ（管理画面）ログインフォーム。salonboard 風の見た目（淡グレー背景に白カード）。
// admin.honeking.* ホストでアクセスされたときに表示される。
const route = useRoute()
const { loggedIn, fetch: fetchSession } = useUserSession()

// すでにログイン済みなら redirect 先 or /dashboard に飛ばす
watchEffect(() => {
  if (loggedIn.value) {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    navigateTo(redirect, { replace: true })
  }
})

const username = ref('')
const password = ref('')
const errorMessage = ref<string | null>(null)
const submitting = ref(false)

// ロゴ画像（public/honeking-logo-180.png）。
// 静的な src="/..." だと Vite の transformAssetUrls がプロジェクトルート基準で
// アセット解決を試み、/_nuxt/@fs/... に化けて 404 になる。
// :src でランタイム URL として渡すとこの変換を回避でき、public 配下を素直に取得する。
const logoUrl = '/honeking-logo-180.png'

// 「お客様サイトを見る」リンク用に admin.* から reserve.* の URL を組み立てる
const requestUrl = useRequestURL()
const customerSiteUrl = computed(() => {
  const customerHost = requestUrl.hostname.replace(/^admin\./, 'reserve.')
  return `${requestUrl.protocol}//${customerHost}${requestUrl.port ? `:${requestUrl.port}` : ''}/`
})

async function onSubmit() {
  errorMessage.value = null
  submitting.value = true
  try {
    await $fetch('/api/admin/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    await fetchSession()
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await navigateTo(redirect, { replace: true })
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || 'ログインに失敗しました'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#f7f8fa] flex items-center justify-center px-4 py-12">
    <div class="w-full max-w-sm">
      <div class="bg-white border border-slate-200 rounded-xl shadow-[0_2px_8px_rgba(15,23,42,0.06)] px-7 py-9">
        <!-- ロゴ（カラー）+ 見出し -->
        <div class="flex flex-col items-center mb-7">
          <img
            :src="logoUrl"
            alt="ほねキング整骨院"
            class="size-12 rounded-lg mb-3"
          >
          <h1 class="text-slate-900 text-lg font-semibold">
            ほねキング整骨院管理画面
          </h1>
          <p class="text-xs text-slate-400 mt-1">
            スタッフログイン
          </p>
        </div>

        <form class="space-y-4" @submit.prevent="onSubmit">
          <div>
            <label for="username" class="block text-sm font-medium text-slate-700 mb-1.5">
              ユーザー名
            </label>
            <input
              id="username"
              v-model="username"
              type="text"
              autocomplete="username"
              required
              class="w-full px-3 py-2.5 text-base text-slate-900 border border-slate-300 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-shadow"
            >
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-slate-700 mb-1.5">
              パスワード
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              class="w-full px-3 py-2.5 text-base text-slate-900 border border-slate-300 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 transition-shadow"
            >
          </div>

          <p v-if="errorMessage" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            {{ errorMessage }}
          </p>

          <button
            type="submit"
            :disabled="submitting"
            class="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            {{ submitting ? 'ログイン中...' : 'ログイン' }}
          </button>
        </form>
      </div>

      <p class="text-center text-xs text-slate-400 mt-6">
        <a :href="customerSiteUrl" class="hover:text-orange-600 hover:underline">
          ← お客様サイトを表示
        </a>
      </p>
    </div>
  </div>
</template>
