<script setup lang="ts">
// パスワードリセット申請ページ
// メアド入力 → POST /api/member/password-reset/request
// レスポンスは存在の有無にかかわらず 200 を返す（メアド漏洩防止）
// → 成功でも失敗でも「メール送りました」表示する

useHead({ title: 'パスワード再設定 | ほねキング整骨院 予約' })

const form = reactive({
  email: '',
})

const fieldErrors = reactive<Record<string, string>>({})
const errorMessage = ref<string | null>(null)
const submitting = ref(false)
const submitted = ref(false)

function validate(): boolean {
  for (const k of Object.keys(fieldErrors)) delete fieldErrors[k]
  if (!form.email.trim()) fieldErrors.email = 'メールアドレスを入力してください'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) fieldErrors.email = 'メールアドレスの形式が正しくありません'
  return Object.keys(fieldErrors).length === 0
}

async function onSubmit() {
  if (submitting.value) return
  if (!validate()) return
  submitting.value = true
  errorMessage.value = null
  try {
    await $fetch('/api/member/password-reset/request', {
      method: 'POST',
      body: { email: form.email.trim() },
    })
    submitted.value = true
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || 'リクエストに失敗しました'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 sm:px-6 py-10">
    <h1 class="text-2xl font-bold text-slate-900 mb-2">
      パスワード再設定
    </h1>
    <p class="text-sm text-slate-600 mb-6">
      ご登録のメールアドレスを入力してください。<br>
      パスワード再設定用のリンクをお送りします。
    </p>

    <!-- 送信完了画面 -->
    <div v-if="submitted" class="rounded-xl border-2 border-orange-300 bg-orange-50 p-6 text-center">
      <UIcon name="i-lucide-mail-check" class="size-12 text-orange-600 mx-auto mb-3" />
      <h2 class="text-lg font-bold text-slate-900 mb-2">
        メールを送信しました
      </h2>
      <p class="text-sm text-slate-700 leading-relaxed">
        入力いただいたメールアドレスに、パスワード再設定用のリンクをお送りしました。<br>
        1 時間以内にメール内のリンクをクリックして、新しいパスワードを設定してください。
      </p>
      <p class="mt-3 text-xs text-slate-500">
        ※ メールが届かない場合は、迷惑メールフォルダもご確認ください。<br>
        ※ 該当する会員アカウントが見つからない場合、メールは送信されません。
      </p>
      <NuxtLink to="/login" class="inline-block mt-5 text-sm text-orange-700 underline hover:text-orange-800">
        ログイン画面に戻る
      </NuxtLink>
    </div>

    <!-- 入力フォーム -->
    <form v-else class="space-y-4" @submit.prevent="onSubmit">
      <UAlert
        v-if="errorMessage"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="errorMessage"
      />

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

      <button
        type="submit"
        :disabled="submitting"
        class="w-full py-3 text-base font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 rounded-md transition"
      >
        {{ submitting ? '送信中…' : '再設定用メールを送信' }}
      </button>

      <div class="text-center text-sm text-slate-600 mt-4">
        <NuxtLink to="/login" class="text-orange-700 font-semibold underline hover:text-orange-800">
          ログイン画面に戻る
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
