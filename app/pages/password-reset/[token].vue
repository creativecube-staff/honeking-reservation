<script setup lang="ts">
// パスワードリセット実行ページ
// URL: /password-reset/[token]
// 新パスワード + 確認入力 → POST /api/member/password-reset/confirm
// 成功時はログイン画面へ誘導

useHead({ title: '新しいパスワードの設定 | ほねキング整骨院 予約' })

const route = useRoute()
const token = computed(() => String(route.params.token ?? ''))

const form = reactive({
  newPassword: '',
  newPasswordConfirm: '',
})

const fieldErrors = reactive<Record<string, string>>({})
const errorMessage = ref<string | null>(null)
const submitting = ref(false)
const submitted = ref(false)

function validate(): boolean {
  for (const k of Object.keys(fieldErrors)) delete fieldErrors[k]
  if (!form.newPassword) fieldErrors.newPassword = 'パスワードを入力してください'
  else if (form.newPassword.length < 8) fieldErrors.newPassword = 'パスワードは 8 文字以上で入力してください'
  if (form.newPassword && form.newPasswordConfirm !== form.newPassword) {
    fieldErrors.newPasswordConfirm = 'パスワード（確認）が一致しません'
  }
  return Object.keys(fieldErrors).length === 0
}

async function onSubmit() {
  if (submitting.value) return
  if (!validate()) return
  submitting.value = true
  errorMessage.value = null
  try {
    await $fetch('/api/member/password-reset/confirm', {
      method: 'POST',
      body: {
        token: token.value,
        newPassword: form.newPassword,
      },
    })
    submitted.value = true
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || 'パスワード再設定に失敗しました'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 sm:px-6 py-10">
    <h1 class="text-2xl font-bold text-slate-900 mb-2">
      新しいパスワードの設定
    </h1>

    <!-- 完了画面 -->
    <div v-if="submitted" class="rounded-xl border-2 border-green-300 bg-green-50 p-6 text-center">
      <UIcon name="i-lucide-circle-check" class="size-12 text-green-600 mx-auto mb-3" />
      <h2 class="text-lg font-bold text-slate-900 mb-2">
        パスワードを再設定しました
      </h2>
      <p class="text-sm text-slate-700 leading-relaxed">
        新しいパスワードで会員ログインができるようになりました。
      </p>
      <NuxtLink
        to="/login"
        class="inline-block mt-5 px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-md transition"
      >
        ログイン画面へ
      </NuxtLink>
    </div>

    <!-- 入力フォーム -->
    <form v-else class="space-y-4" @submit.prevent="onSubmit">
      <p class="text-sm text-slate-600">
        新しいパスワードを入力してください。
      </p>

      <UAlert
        v-if="errorMessage"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="errorMessage"
      />

      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">
          新しいパスワード <span class="text-red-600">*</span>
          <span class="ml-1 text-xs font-normal text-slate-500">（8 文字以上）</span>
        </label>
        <input
          v-model="form.newPassword"
          type="password"
          autocomplete="new-password"
          required
          class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
        >
        <p v-if="fieldErrors.newPassword" class="mt-1 text-xs text-red-600">
          {{ fieldErrors.newPassword }}
        </p>
      </div>

      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">
          新しいパスワード（確認） <span class="text-red-600">*</span>
        </label>
        <input
          v-model="form.newPasswordConfirm"
          type="password"
          autocomplete="new-password"
          required
          class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
        >
        <p v-if="fieldErrors.newPasswordConfirm" class="mt-1 text-xs text-red-600">
          {{ fieldErrors.newPasswordConfirm }}
        </p>
      </div>

      <button
        type="submit"
        :disabled="submitting"
        class="w-full py-3 text-base font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 rounded-md transition"
      >
        {{ submitting ? '送信中…' : 'パスワードを再設定' }}
      </button>
    </form>
  </div>
</template>
