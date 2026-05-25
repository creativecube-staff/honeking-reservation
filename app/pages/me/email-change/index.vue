<script setup lang="ts">
// マイページ: メアド変更（新メアド入力 → 認証メール送信）

definePageMeta({ middleware: 'member-auth' })
useHead({ title: 'メールアドレス変更 | マイページ' })

const { member } = useMember()

const form = reactive({
  newEmail: '',
})
const fieldErrors = reactive<Record<string, string>>({})
const errorMessage = ref<string | null>(null)
const submitting = ref(false)
const submitted = ref(false)

function validate(): boolean {
  for (const k of Object.keys(fieldErrors)) delete fieldErrors[k]
  if (!form.newEmail.trim()) fieldErrors.newEmail = '新しいメールアドレスを入力してください'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.newEmail.trim())) fieldErrors.newEmail = 'メールアドレスの形式が正しくありません'
  return Object.keys(fieldErrors).length === 0
}

async function onSubmit() {
  if (submitting.value) return
  if (!validate()) return
  submitting.value = true
  errorMessage.value = null
  try {
    await $fetch('/api/member/email-change/request', {
      method: 'POST',
      body: { newEmail: form.newEmail.trim() },
    })
    submitted.value = true
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || 'メールアドレス変更の申請に失敗しました'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 sm:px-6 py-8">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
        <UIcon name="i-lucide-mail" class="size-6 text-orange-500" />
        メールアドレス変更
      </h1>
      <NuxtLink to="/me" class="text-sm text-slate-600 hover:text-orange-700 inline-flex items-center gap-1">
        <UIcon name="i-lucide-chevron-left" class="size-4" />
        マイページ
      </NuxtLink>
    </div>

    <div class="max-w-lg mx-auto">
      <!-- 完了画面(新メアドにメール送信済) -->
      <div v-if="submitted" class="rounded-xl border-2 border-orange-300 bg-orange-50 p-6 text-center">
        <UIcon name="i-lucide-mail-check" class="size-12 text-orange-600 mx-auto mb-3" />
        <h2 class="text-lg font-bold text-slate-900 mb-2">
          確認メールを送信しました
        </h2>
        <p class="text-sm text-slate-700 leading-relaxed">
          <span class="font-semibold">{{ form.newEmail }}</span> に確認メールをお送りしました。<br>
          24 時間以内にメール内のリンクをクリックして、変更を完了してください。
        </p>
        <p class="mt-3 text-xs text-slate-500">
          ※ 確認リンクをクリックするまでは、現在のメールアドレスが有効です。
        </p>
        <NuxtLink to="/me" class="inline-block mt-5 text-sm text-orange-700 underline hover:text-orange-800">
          マイページに戻る
        </NuxtLink>
      </div>

      <!-- 入力フォーム -->
      <form v-else class="space-y-4" @submit.prevent="onSubmit">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm">
          <p class="text-slate-500 text-xs mb-0.5">現在のメールアドレス</p>
          <p class="font-semibold text-slate-900 break-all inline-flex items-center gap-1.5">
            <UIcon name="i-lucide-mail" class="size-4 text-slate-400" />
            {{ member?.email ?? '—' }}
          </p>
        </div>

        <UAlert
          v-if="errorMessage"
          color="error"
          icon="i-lucide-triangle-alert"
          :title="errorMessage"
        />

        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">
            新しいメールアドレス <span class="text-red-600">*</span>
          </label>
          <div class="relative">
            <UIcon name="i-lucide-mail" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              v-model="form.newEmail"
              type="email"
              autocomplete="email"
              required
              class="w-full pl-9 pr-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 bg-white"
              :class="fieldErrors.newEmail ? 'border-red-500' : ''"
              placeholder="example@email.com"
            >
          </div>
          <p v-if="fieldErrors.newEmail" class="mt-1 text-xs text-red-600">
            {{ fieldErrors.newEmail }}
          </p>
        </div>

        <p class="text-xs text-slate-500">
          ※ 確認リンクをクリックするまで変更は完了しません。<br>
          ※ 新しいメールアドレスが他のお客様に登録されている場合は変更できません。
        </p>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full inline-flex items-center justify-center gap-2 py-3.5 text-base font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 rounded-lg shadow-sm transition cursor-pointer"
        >
          <UIcon
            :name="submitting ? 'i-lucide-loader-2' : 'i-lucide-send'"
            class="size-5"
            :class="submitting ? 'animate-spin' : ''"
          />
          {{ submitting ? '送信中…' : '確認メールを送信' }}
        </button>
      </form>
    </div>
  </div>
</template>
