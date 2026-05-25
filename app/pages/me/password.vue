<script setup lang="ts">
// マイページ: パスワード変更（現在のパスワード認証 → 新パスワード設定）

definePageMeta({ middleware: 'member-auth' })
useHead({ title: 'パスワード変更 | マイページ' })

const form = reactive({
  currentPassword: '',
  newPassword: '',
  newPasswordConfirm: '',
})
const fieldErrors = reactive<Record<string, string>>({})
const errorMessage = ref<string | null>(null)
const submitting = ref(false)
const successMessage = ref<string | null>(null)

function validate(): boolean {
  for (const k of Object.keys(fieldErrors)) delete fieldErrors[k]
  if (!form.currentPassword) fieldErrors.currentPassword = '現在のパスワードを入力してください'
  if (!form.newPassword) fieldErrors.newPassword = '新しいパスワードを入力してください'
  else if (form.newPassword.length < 8) fieldErrors.newPassword = '新しいパスワードは 8 文字以上で入力してください'
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
  successMessage.value = null
  try {
    await $fetch('/api/member/password', {
      method: 'PATCH',
      body: {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      },
    })
    successMessage.value = 'パスワードを変更しました'
    form.currentPassword = ''
    form.newPassword = ''
    form.newPasswordConfirm = ''
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || 'パスワード変更に失敗しました'
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
        <UIcon name="i-lucide-key-round" class="size-6 text-orange-500" />
        パスワード変更
      </h1>
      <NuxtLink to="/me" class="text-sm text-slate-600 hover:text-orange-700 inline-flex items-center gap-1">
        <UIcon name="i-lucide-chevron-left" class="size-4" />
        マイページ
      </NuxtLink>
    </div>

    <div class="max-w-lg mx-auto">
      <form class="space-y-4" @submit.prevent="onSubmit">
        <UAlert
          v-if="errorMessage"
          color="error"
          icon="i-lucide-triangle-alert"
          :title="errorMessage"
        />
        <UAlert
          v-if="successMessage"
          color="success"
          icon="i-lucide-circle-check"
          :title="successMessage"
        />

        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">
            現在のパスワード <span class="text-red-600">*</span>
          </label>
          <div class="relative">
            <UIcon name="i-lucide-lock" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              v-model="form.currentPassword"
              type="password"
              autocomplete="current-password"
              required
              class="w-full pl-9 pr-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 bg-white"
              :class="fieldErrors.currentPassword ? 'border-red-500' : ''"
            >
          </div>
          <p v-if="fieldErrors.currentPassword" class="mt-1 text-xs text-red-600">
            {{ fieldErrors.currentPassword }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">
            新しいパスワード <span class="text-red-600">*</span>
            <span class="ml-1 text-xs font-normal text-slate-500">(8 文字以上)</span>
          </label>
          <div class="relative">
            <UIcon name="i-lucide-key-round" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              v-model="form.newPassword"
              type="password"
              autocomplete="new-password"
              required
              class="w-full pl-9 pr-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 bg-white"
              :class="fieldErrors.newPassword ? 'border-red-500' : ''"
            >
          </div>
          <p v-if="fieldErrors.newPassword" class="mt-1 text-xs text-red-600">
            {{ fieldErrors.newPassword }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">
            新しいパスワード(確認) <span class="text-red-600">*</span>
          </label>
          <div class="relative">
            <UIcon name="i-lucide-key-round" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              v-model="form.newPasswordConfirm"
              type="password"
              autocomplete="new-password"
              required
              class="w-full pl-9 pr-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 bg-white"
              :class="fieldErrors.newPasswordConfirm ? 'border-red-500' : ''"
            >
          </div>
          <p v-if="fieldErrors.newPasswordConfirm" class="mt-1 text-xs text-red-600">
            {{ fieldErrors.newPasswordConfirm }}
          </p>
        </div>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full inline-flex items-center justify-center gap-2 py-3.5 text-base font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 rounded-lg shadow-sm transition cursor-pointer"
        >
          <UIcon
            :name="submitting ? 'i-lucide-loader-2' : 'i-lucide-check-circle-2'"
            class="size-5"
            :class="submitting ? 'animate-spin' : ''"
          />
          {{ submitting ? '変更中…' : 'パスワードを変更' }}
        </button>
      </form>
    </div>
  </div>
</template>
