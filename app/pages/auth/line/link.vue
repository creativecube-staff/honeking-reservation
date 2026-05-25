<script setup lang="ts">
// LINE Login で既存メアドにヒットした場合のパスワード本人確認画面。
// callback ハンドラから 302 で誘導される。
//
// 流れ:
// 1. /api/auth/line/pending で「LINE 連携待ち」状態を取得
// 2. ヒットしている既存会員のマスク済メアドと氏名を表示
// 3. パスワード入力 → /api/auth/line/link-password
// 4. 成功で /me へ

useHead({ title: 'LINE 連携 | ほねキング整骨院 予約' })
definePageMeta({ layout: 'default' })

const router = useRouter()
const { refresh: refreshMember } = useMember()

type Pending = {
  lineDisplayName: string | null
  hasEmail: boolean
  matched: { maskedEmail: string | null, name: string } | null
}

const { data, pending, refresh } = await useFetch<{ pending: Pending | null }>('/api/auth/line/pending', {
  key: 'line-pending',
})

// セッションが切れていたらログインに戻す
if (!data.value?.pending || !data.value.pending.matched) {
  if (import.meta.client) {
    router.replace('/login?line=expired')
  }
}

const password = ref('')
const errorMessage = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  if (submitting.value) return
  if (!password.value) {
    errorMessage.value = 'パスワードを入力してください'
    return
  }
  submitting.value = true
  errorMessage.value = null
  try {
    await $fetch('/api/auth/line/link-password', {
      method: 'POST',
      body: { password: password.value },
    })
    await refreshMember()
    await router.push('/me')
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || '連携に失敗しました'
  }
  finally {
    submitting.value = false
  }
}

function onCancel() {
  refresh()
  router.push('/login')
}
</script>

<template>
  <div class="mx-auto max-w-lg px-4 sm:px-6 py-10">
    <h1 class="text-xl sm:text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2">
      <svg viewBox="0 0 24 24" class="size-7" fill="#06C755" aria-hidden="true">
        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
      </svg>
      LINE で続行
    </h1>

    <div v-if="pending" class="text-center py-8 text-slate-500 text-sm">
      <UIcon name="i-lucide-loader-circle" class="size-6 mx-auto animate-spin mb-2" />
      読み込み中...
    </div>

    <div v-else-if="data?.pending?.matched" class="space-y-5">
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p class="text-sm text-slate-700 mb-1">
          このメールアドレスで既に会員登録があります。
        </p>
        <p class="text-base font-semibold text-slate-900 mb-2">
          {{ data.pending.matched.name }} 様
        </p>
        <p class="text-sm text-slate-600">
          <UIcon name="i-lucide-mail" class="inline size-4 mr-1 text-slate-500" />
          {{ data.pending.matched.maskedEmail }}
        </p>
      </div>

      <p class="text-sm text-slate-700 leading-relaxed">
        本人確認のため、現在のパスワードを入力してください。<br>
        確認できたら LINE アカウントを連携します。
      </p>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <UAlert
          v-if="errorMessage"
          color="error"
          icon="i-lucide-triangle-alert"
          :title="errorMessage"
        />

        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">
            パスワード
          </label>
          <div class="relative">
            <UIcon name="i-lucide-lock" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              class="w-full pl-9 pr-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 bg-white"
            >
          </div>
        </div>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full inline-flex items-center justify-center gap-2 py-3.5 text-base font-bold text-white bg-[#06C755] hover:bg-[#05a647] disabled:opacity-60 rounded-lg shadow-sm transition cursor-pointer"
        >
          <UIcon
            :name="submitting ? 'i-lucide-loader-2' : 'i-lucide-link'"
            class="size-5"
            :class="submitting ? 'animate-spin' : ''"
          />
          {{ submitting ? '連携中…' : 'LINE と連携する' }}
        </button>

        <div class="text-center">
          <button
            type="button"
            class="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2 cursor-pointer"
            @click="onCancel"
          >
            やめる
          </button>
        </div>

        <div class="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p class="font-semibold text-slate-700 mb-1">
            パスワードを忘れた場合
          </p>
          <NuxtLink to="/password-reset" class="text-orange-700 underline hover:text-orange-800">
            パスワード再設定はこちら
          </NuxtLink>
        </div>
      </form>
    </div>
  </div>
</template>
