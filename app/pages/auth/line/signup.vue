<script setup lang="ts">
// LINE Login 経由の新規会員登録ページ。
// callback ハンドラから 302 で誘導される（既存会員ヒットなしのケース）。
//
// 流れ:
// 1. /api/auth/line/pending で「LINE 連携待ち」状態を取得
// 2. LINE 取得済の displayName を name に pre-fill、email が取れていれば email も pre-fill
// 3. パスワード・電話・規約同意を入力
// 4. POST /api/auth/line/signup
//    - LINE 提供 email と一致 → emailVerifiedAt = now、即セッション発行 → /me
//    - 異なる or LINE が email 出してない → 通常の認証メール送信フロー

useHead({ title: 'LINE で会員登録 | ほねキング整骨院 予約' })
definePageMeta({ layout: 'default' })

const router = useRouter()
const { refresh: refreshMember } = useMember()

type Pending = {
  lineDisplayName: string | null
  hasEmail: boolean
  matched: { maskedEmail: string | null, name: string } | null
}

const { data, pending } = await useFetch<{ pending: Pending | null }>('/api/auth/line/pending', {
  key: 'line-pending-signup',
})

if (!data.value?.pending) {
  if (import.meta.client) {
    router.replace('/signup?line=expired')
  }
}

// pre-fill: LINE displayName を name に
const form = reactive({
  email: '',
  password: '',
  passwordConfirm: '',
  name: data.value?.pending?.lineDisplayName ?? '',
  phone: '',
  agreeTerms: false,
})

const fieldErrors = reactive<Record<string, string>>({})
const errorMessage = ref<string | null>(null)
const submitting = ref(false)
const submitted = ref<'verified' | 'mail-sent' | null>(null)

function validate(): boolean {
  for (const k of Object.keys(fieldErrors)) delete fieldErrors[k]
  if (!form.email.trim()) fieldErrors.email = 'メールアドレスを入力してください'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) fieldErrors.email = 'メールアドレスの形式が正しくありません'

  if (!form.password) fieldErrors.password = 'パスワードを入力してください'
  else if (form.password.length < 8) fieldErrors.password = 'パスワードは 8 文字以上で入力してください'

  if (form.password && form.passwordConfirm !== form.password) {
    fieldErrors.passwordConfirm = 'パスワード（確認）が一致しません'
  }

  if (!form.name.trim()) fieldErrors.name = 'お名前を入力してください'
  if (!form.phone.trim()) fieldErrors.phone = '電話番号を入力してください'
  if (!form.agreeTerms) fieldErrors.agreeTerms = '会員規約とプライバシーポリシーへの同意が必要です'

  return Object.keys(fieldErrors).length === 0
}

async function onSubmit() {
  if (submitting.value) return
  if (!validate()) return
  submitting.value = true
  errorMessage.value = null
  try {
    const res = await $fetch<{ ok: true, verified: boolean }>('/api/auth/line/signup', {
      method: 'POST',
      body: {
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        phone: form.phone.trim(),
        agreeTerms: true,
      },
    })
    if (res.verified) {
      // LINE 提供メアドと一致 → 即ログイン完了
      await refreshMember()
      await router.push('/me')
    }
    else {
      submitted.value = 'mail-sent'
    }
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || '会員登録に失敗しました'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 sm:px-6 py-10">
    <h1 class="text-xl sm:text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2">
      <svg viewBox="0 0 24 24" class="size-7" fill="#06C755" aria-hidden="true">
        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
      </svg>
      LINE で会員登録
    </h1>
    <p class="text-sm text-slate-600 mb-5">
      LINE のアカウントで認証しました。あと数項目で会員登録が完了します。
    </p>

    <div v-if="pending" class="text-center py-8 text-slate-500 text-sm">
      <UIcon name="i-lucide-loader-circle" class="size-6 mx-auto animate-spin mb-2" />
      読み込み中...
    </div>

    <!-- 完了: 認証メール送信 -->
    <div v-else-if="submitted === 'mail-sent'" class="rounded-xl border-2 border-orange-300 bg-orange-50 p-6 text-center">
      <UIcon name="i-lucide-mail-check" class="size-12 text-orange-600 mx-auto mb-3" />
      <h2 class="text-lg font-bold text-slate-900 mb-2">
        確認メールを送信しました
      </h2>
      <p class="text-sm text-slate-700 leading-relaxed">
        入力いただいたメールアドレス宛に確認メールをお送りしました。<br>
        24 時間以内にメール内のリンクをクリックして、会員登録を完了してください。
      </p>
      <p class="mt-3 text-xs text-slate-500">
        ※ LINE 連携は確定済みです。メール認証完了でログインできるようになります。
      </p>
    </div>

    <form v-else class="space-y-4" @submit.prevent="onSubmit">
      <UAlert
        v-if="errorMessage"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="errorMessage"
      />

      <!-- 案内 -->
      <div v-if="data?.pending?.lineDisplayName" class="rounded-md border border-[#06C755]/30 bg-[#06C755]/5 p-3 text-sm text-slate-700">
        LINE プロフィール「<span class="font-semibold">{{ data.pending.lineDisplayName }}</span>」で認証しました。
      </div>

      <!-- お名前 -->
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">
          お名前 <span class="text-red-600">*</span>
        </label>
        <input
          v-model="form.name"
          type="text"
          autocomplete="name"
          required
          class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          placeholder="山田 太郎"
        >
        <p v-if="fieldErrors.name" class="mt-1 text-xs text-red-600">
          {{ fieldErrors.name }}
        </p>
      </div>

      <!-- 電話番号 -->
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">
          電話番号 <span class="text-red-600">*</span>
        </label>
        <input
          v-model="form.phone"
          type="tel"
          autocomplete="tel"
          required
          class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          placeholder="090-1234-5678"
        >
        <p v-if="fieldErrors.phone" class="mt-1 text-xs text-red-600">
          {{ fieldErrors.phone }}
        </p>
      </div>

      <!-- メアド -->
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">
          メールアドレス <span class="text-red-600">*</span>
          <span v-if="!data?.pending?.hasEmail" class="ml-1 text-xs font-normal text-slate-500">
            （LINE からは取得できなかったため入力してください）
          </span>
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

      <!-- パスワード -->
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">
          パスワード <span class="text-red-600">*</span>
          <span class="ml-1 text-xs font-normal text-slate-500">（8 文字以上）</span>
        </label>
        <input
          v-model="form.password"
          type="password"
          autocomplete="new-password"
          required
          class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
        >
        <p v-if="fieldErrors.password" class="mt-1 text-xs text-red-600">
          {{ fieldErrors.password }}
        </p>
      </div>

      <!-- パスワード確認 -->
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">
          パスワード（確認） <span class="text-red-600">*</span>
        </label>
        <input
          v-model="form.passwordConfirm"
          type="password"
          autocomplete="new-password"
          required
          class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
        >
        <p v-if="fieldErrors.passwordConfirm" class="mt-1 text-xs text-red-600">
          {{ fieldErrors.passwordConfirm }}
        </p>
      </div>

      <!-- 同意チェック -->
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <label class="inline-flex items-start gap-2 text-sm text-slate-700">
          <input
            v-model="form.agreeTerms"
            type="checkbox"
            class="mt-1 size-4 border-slate-300 rounded text-orange-500 focus:ring-orange-500"
          >
          <span>
            <NuxtLink to="/terms" target="_blank" rel="noopener noreferrer" class="text-orange-700 font-semibold underline hover:text-orange-800">
              会員規約
            </NuxtLink>
            と
            <NuxtLink to="/privacy" target="_blank" rel="noopener noreferrer" class="text-orange-700 font-semibold underline hover:text-orange-800">
              プライバシーポリシー
            </NuxtLink>
            に同意します
          </span>
        </label>
        <p v-if="fieldErrors.agreeTerms" class="mt-1 text-xs text-red-600">
          {{ fieldErrors.agreeTerms }}
        </p>
      </div>

      <button
        type="submit"
        :disabled="submitting"
        class="w-full py-3 text-base font-bold text-white bg-[#06C755] hover:bg-[#05a647] disabled:opacity-60 rounded-md transition"
      >
        {{ submitting ? '送信中…' : '会員登録を完了する' }}
      </button>
    </form>
  </div>
</template>
