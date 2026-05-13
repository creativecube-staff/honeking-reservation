<script setup lang="ts">
// メール認証完了ページ
// URL: /verify-email/[token]
// 流れ:
// 1. URL のトークンを取得
// 2. POST /api/member/verify-email にトークンを送信
// 3. 成功 → 「認証完了」表示 + ログインリンク
// 4. 失敗 → エラー文言表示

useHead({ title: 'メール認証 | ほねキング整骨院 予約' })

const route = useRoute()
const token = computed(() => String(route.params.token ?? ''))

const status = ref<'loading' | 'success' | 'error'>('loading')
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  if (!token.value) {
    status.value = 'error'
    errorMessage.value = 'トークンが指定されていません。'
    return
  }
  try {
    await $fetch('/api/member/verify-email', {
      method: 'POST',
      body: { token: token.value },
    })
    status.value = 'success'
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || 'メール認証に失敗しました'
    status.value = 'error'
  }
})
</script>

<template>
  <div class="mx-auto max-w-md px-4 sm:px-6 py-12">
    <div v-if="status === 'loading'" class="text-center text-slate-600">
      <UIcon name="i-lucide-loader-circle" class="size-10 mx-auto animate-spin text-orange-500 mb-3" />
      <p>認証中...</p>
    </div>

    <div v-else-if="status === 'success'" class="rounded-xl border-2 border-green-300 bg-green-50 p-6 text-center">
      <UIcon name="i-lucide-circle-check" class="size-12 text-green-600 mx-auto mb-3" />
      <h1 class="text-lg font-bold text-slate-900 mb-2">
        会員登録が完了しました
      </h1>
      <p class="text-sm text-slate-700 leading-relaxed">
        メールアドレスの認証が完了し、会員登録が確定しました。<br>
        ログインしてご予約をお取りください。
      </p>
      <NuxtLink
        to="/login"
        class="inline-block mt-5 px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-md transition"
      >
        ログイン画面へ
      </NuxtLink>
    </div>

    <div v-else class="rounded-xl border-2 border-red-300 bg-red-50 p-6 text-center">
      <UIcon name="i-lucide-circle-alert" class="size-12 text-red-600 mx-auto mb-3" />
      <h1 class="text-lg font-bold text-slate-900 mb-2">
        認証に失敗しました
      </h1>
      <p class="text-sm text-slate-700 leading-relaxed">
        {{ errorMessage }}
      </p>
      <p class="mt-4 text-xs text-slate-500">
        リンクの有効期限が切れている場合は、再度
        <NuxtLink to="/signup" class="text-orange-700 underline hover:text-orange-800">
          会員登録
        </NuxtLink>
        をお試しください。
      </p>
    </div>
  </div>
</template>
