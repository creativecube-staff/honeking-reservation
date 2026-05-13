<script setup lang="ts">
// 会員ログインページ
// 入力 → POST /api/member/login → 成功なら / にリダイレクト

useHead({ title: 'ログイン | ほねキング整骨院 予約' })

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
    // ログイン状態を header 等の useMember()利用箇所に伝播
    await refreshMember()
    // ?redirect=... が指定されていればそこへ、無ければトップへ
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
  <div class="mx-auto max-w-md px-4 sm:px-6 py-10">
    <h1 class="text-2xl font-bold text-slate-900 mb-2">
      会員ログイン
    </h1>
    <p class="text-sm text-slate-600 mb-6">
      会員登録時のメールアドレスとパスワードを入力してください。
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
          メールアドレス
        </label>
        <input
          v-model="form.email"
          type="email"
          autocomplete="email"
          required
          class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          placeholder="example@email.com"
        >
        <p v-if="fieldErrors.email" class="mt-1 text-xs text-red-600">
          {{ fieldErrors.email }}
        </p>
      </div>

      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">
          パスワード
        </label>
        <input
          v-model="form.password"
          type="password"
          autocomplete="current-password"
          required
          class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
        >
        <p v-if="fieldErrors.password" class="mt-1 text-xs text-red-600">
          {{ fieldErrors.password }}
        </p>
      </div>

      <button
        type="submit"
        :disabled="submitting"
        class="w-full py-3 text-base font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 rounded-md transition"
      >
        {{ submitting ? 'ログイン中…' : 'ログイン' }}
      </button>

      <div class="text-center text-sm text-slate-600 space-y-1 mt-4">
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
</template>
