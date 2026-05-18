<script setup lang="ts">
// スタッフ（管理画面）ログインフォーム。WordPress 風の見た目。
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
  <div class="min-h-screen bg-[#f0f0f1] flex items-start justify-center pt-20 px-4">
    <div class="w-full max-w-sm">
      <h1 class="text-center text-slate-900 text-xl font-semibold mb-6 tracking-wide">
        honeking 管理画面
      </h1>

      <form
        class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-6 py-7 space-y-5"
        @submit.prevent="onSubmit"
      >
        <div>
          <label for="username" class="block text-sm font-semibold text-slate-900 mb-1.5">
            ユーザー名
          </label>
          <input
            id="username"
            v-model="username"
            type="text"
            autocomplete="username"
            required
            class="w-full px-2.5 py-2 text-base border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_1px_#f97316]"
          >
        </div>

        <div>
          <label for="password" class="block text-sm font-semibold text-slate-900 mb-1.5">
            パスワード
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full px-2.5 py-2 text-base border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_1px_#f97316]"
          >
        </div>

        <div class="flex items-center justify-end pt-1">
          <button
            type="submit"
            :disabled="submitting"
            class="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm shadow-sm transition-colors"
          >
            {{ submitting ? 'ログイン中...' : 'ログイン' }}
          </button>
        </div>

        <p v-if="errorMessage" class="text-sm text-red-700 bg-red-50 border-l-4 border-red-600 px-3 py-2">
          {{ errorMessage }}
        </p>
      </form>

      <p class="text-center text-xs text-slate-500 mt-5">
        <a :href="customerSiteUrl" class="hover:text-orange-600 hover:underline">
          ← お客様サイトを表示
        </a>
      </p>
    </div>
  </div>
</template>
