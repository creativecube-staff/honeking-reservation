<script setup lang="ts">
// 会員ログインフォーム（お客様向け）。
// reserve.honeking.* ホストでアクセスされたときに表示される。
const route = useRoute()
const router = useRouter()
const { refresh: refreshMember } = useMember()

const form = reactive({
  email: '',
  password: '',
})

const fieldErrors = reactive<Record<string, string>>({})
const errorMessage = ref<string | null>(null)
const submitting = ref(false)

// LINE 連携導線: クエリ ?line= で callback の通知が乗ってくる
const lineNotice = computed(() => {
  const v = route.query.line
  if (v === 'cancelled') return 'LINE ログインがキャンセルされました。'
  if (v === 'expired') return 'LINE 連携の有効期限が切れました。もう一度お試しください。'
  if (v === 'error') return 'LINE ログインに失敗しました。時間をおいて再度お試しください。'
  return null
})

function lineLoginHref(): string {
  const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
    ? `?redirect=${encodeURIComponent(route.query.redirect)}`
    : ''
  return `/api/auth/line/start${redirect}`
}

function validate(): boolean {
  for (const k of Object.keys(fieldErrors)) delete fieldErrors[k]
  if (!form.email.trim()) fieldErrors.email = 'メールアドレスを入力してください'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) fieldErrors.email = 'メールアドレスの形式が正しくありません'
  if (!form.password) fieldErrors.password = 'パスワードを入力してください'
  return Object.keys(fieldErrors).length === 0
}

async function onSubmit() {
  if (submitting.value) return
  if (!validate()) return
  submitting.value = true
  errorMessage.value = null
  try {
    await $fetch('/api/member/login', {
      method: 'POST',
      body: {
        email: form.email.trim(),
        password: form.password,
      },
    })
    await refreshMember()
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
      ? route.query.redirect
      : '/'
    await router.push(redirect)
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
  <div class="mx-auto max-w-5xl px-4 sm:px-6 py-10">
    <h1 class="text-xl sm:text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
      <UIcon name="i-lucide-log-in" class="size-6 text-orange-500" />
      会員ログイン
    </h1>

    <div class="max-w-lg mx-auto">
      <p class="text-sm text-slate-600 mb-6">
        会員登録時のメールアドレスとパスワードを入力してください。
      </p>

      <!-- LINE で続行 / ログイン -->
      <a
        :href="lineLoginHref()"
        class="w-full inline-flex items-center justify-center gap-2 py-3.5 text-base font-bold text-white bg-[#06C755] hover:bg-[#05a647] rounded-lg shadow-sm transition cursor-pointer mb-3"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
        </svg>
        LINE でログイン
      </a>

      <div class="flex items-center gap-3 my-4">
        <div class="flex-1 h-px bg-slate-200" />
        <span class="text-xs text-slate-500">または</span>
        <div class="flex-1 h-px bg-slate-200" />
      </div>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <UAlert
          v-if="lineNotice"
          color="warning"
          icon="i-lucide-info"
          :title="lineNotice"
        />
        <UAlert
          v-if="errorMessage"
          color="error"
          icon="i-lucide-triangle-alert"
          :title="errorMessage"
        />

        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">
            メールアドレス
          </label>
          <div class="relative">
            <UIcon name="i-lucide-mail" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              v-model="form.email"
              type="email"
              autocomplete="email"
              required
              class="w-full pl-9 pr-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 bg-white"
              placeholder="example@email.com"
            >
          </div>
          <p v-if="fieldErrors.email" class="mt-1 text-xs text-red-600">
            {{ fieldErrors.email }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">
            パスワード
          </label>
          <div class="relative">
            <UIcon name="i-lucide-lock" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              required
              class="w-full pl-9 pr-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 bg-white"
            >
          </div>
          <p v-if="fieldErrors.password" class="mt-1 text-xs text-red-600">
            {{ fieldErrors.password }}
          </p>
        </div>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full inline-flex items-center justify-center gap-2 py-3.5 text-base font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 rounded-lg shadow-sm transition cursor-pointer"
        >
          <UIcon
            :name="submitting ? 'i-lucide-loader-2' : 'i-lucide-log-in'"
            class="size-5"
            :class="submitting ? 'animate-spin' : ''"
          />
          {{ submitting ? 'ログイン中…' : 'ログイン' }}
        </button>

        <div class="text-center text-sm text-slate-600 space-y-1.5 mt-4">
          <p>
            会員でない方は
            <NuxtLink to="/signup" class="text-orange-700 font-semibold underline hover:text-orange-800">
              新規会員登録
            </NuxtLink>
          </p>
          <p>
            パスワードをお忘れの方は
            <NuxtLink to="/password-reset" class="text-orange-700 font-semibold underline hover:text-orange-800">
              こちら
            </NuxtLink>
          </p>
          <p>
            メールアドレスをお忘れの方は
            <NuxtLink to="/forgot-email" class="text-orange-700 font-semibold underline hover:text-orange-800">
              こちら
            </NuxtLink>
          </p>
        </div>
      </form>
    </div>
  </div>
</template>
