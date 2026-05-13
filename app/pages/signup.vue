<script setup lang="ts">
// 会員登録（仮登録）ページ
// 入力 → POST /api/member/signup → メール送信完了画面に遷移
//
// 流れ:
// 1. メアド・パスワード・氏名・電話を入力
// 2. 規約・プライバシーポリシー同意チェック
// 3. 送信ボタン → API 呼び出し → 成功なら「メール送りました」画面
// 4. ユーザーがメールリンクをクリック → /verify-email/[token] で本登録完了

useHead({ title: '会員登録 | ほねキング整骨院 予約' })

const form = reactive({
  email: '',
  password: '',
  passwordConfirm: '',
  name: '',
  phone: '',
  agreeTerms: false,
})

const fieldErrors = reactive<Record<string, string>>({})
const errorMessage = ref<string | null>(null)
const submitting = ref(false)
const submitted = ref(false) // 成功後フラグ。フォームを隠して「メール送ったよ」表示にする

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
    await $fetch('/api/member/signup', {
      method: 'POST',
      body: {
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        phone: form.phone.trim(),
        agreeTerms: true,
      },
    })
    submitted.value = true
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
    <h1 class="text-2xl font-bold text-slate-900 mb-2">
      会員登録
    </h1>
    <p class="text-sm text-slate-600 mb-6">
      会員になると次回からのご予約時にお名前・連絡先の入力が不要になります。
    </p>

    <!-- 登録完了画面（仮登録 → メール認証待ち） -->
    <div v-if="submitted" class="rounded-xl border-2 border-orange-300 bg-orange-50 p-6 text-center">
      <UIcon name="i-lucide-mail-check" class="size-12 text-orange-600 mx-auto mb-3" />
      <h2 class="text-lg font-bold text-slate-900 mb-2">
        確認メールを送信しました
      </h2>
      <p class="text-sm text-slate-700 leading-relaxed">
        入力いただいたメールアドレス宛に確認メールをお送りしました。<br>
        24 時間以内にメール内のリンクをクリックして、会員登録を完了してください。
      </p>
      <p class="mt-3 text-xs text-slate-500">
        ※ メールが届かない場合は、迷惑メールフォルダもご確認ください。
      </p>
      <NuxtLink
        to="/"
        class="inline-block mt-5 text-sm text-orange-700 underline hover:text-orange-800"
      >
        トップに戻る
      </NuxtLink>
    </div>

    <!-- 登録フォーム -->
    <form v-else class="space-y-4" @submit.prevent="onSubmit">
      <UAlert
        v-if="errorMessage"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="errorMessage"
      />

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
        <p class="mt-2 text-xs text-slate-500">
          ※ お名前・電話番号・メールアドレスは暗号化（AES-256-GCM）して保存します
        </p>
      </div>

      <!-- 送信ボタン -->
      <button
        type="submit"
        :disabled="submitting"
        class="w-full py-3 text-base font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 rounded-md transition"
      >
        {{ submitting ? '送信中…' : '確認メールを送信' }}
      </button>

      <p class="text-center text-sm text-slate-600 mt-4">
        すでに会員の方は
        <NuxtLink to="/login" class="text-orange-700 font-semibold underline hover:text-orange-800">
          ログイン
        </NuxtLink>
      </p>
    </form>
  </div>
</template>
