<script setup lang="ts">
// マイページ: 氏名・電話番号の変更
// メアドはここでは触らない（再認証フローのため /me/email-change で別管理）

definePageMeta({ middleware: 'member-auth' })
useHead({ title: 'プロフィール変更 | マイページ' })

const { member, refresh: refreshMember } = useMember()

const form = reactive({
  name: '',
  phone: '',
})
const fieldErrors = reactive<Record<string, string>>({})
const errorMessage = ref<string | null>(null)
const submitting = ref(false)
const successMessage = ref<string | null>(null)

// member データが揃ったら初期値をセット
watchEffect(() => {
  if (member.value && !form.name && !form.phone) {
    form.name = member.value.name
    form.phone = member.value.phone ?? ''
  }
})

function validate(): boolean {
  for (const k of Object.keys(fieldErrors)) delete fieldErrors[k]
  if (!form.name.trim()) fieldErrors.name = 'お名前を入力してください'
  if (!form.phone.trim()) fieldErrors.phone = '電話番号を入力してください'
  return Object.keys(fieldErrors).length === 0
}

async function onSubmit() {
  if (submitting.value) return
  if (!validate()) return
  submitting.value = true
  errorMessage.value = null
  successMessage.value = null
  try {
    await $fetch('/api/member/profile', {
      method: 'PATCH',
      body: {
        name: form.name.trim(),
        phone: form.phone.trim(),
      },
    })
    await refreshMember()
    successMessage.value = 'プロフィールを更新しました'
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || '更新に失敗しました'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 sm:px-6 py-8">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
        <UIcon name="i-lucide-user-pen" class="size-6 text-orange-500" />
        プロフィール変更
      </h1>
      <NuxtLink to="/me" class="text-sm text-slate-600 hover:text-orange-700 inline-flex items-center gap-1">
        <UIcon name="i-lucide-chevron-left" class="size-4" />
        マイページ
      </NuxtLink>
    </div>

    <p class="text-xs text-slate-500 mb-4">
      メールアドレスの変更は
      <NuxtLink to="/me/email-change" class="text-orange-700 underline hover:text-orange-800">
        こちら
      </NuxtLink>
      から行えます。
    </p>

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
          お名前 <span class="text-red-600">*</span>
        </label>
        <input
          v-model="form.name"
          type="text"
          autocomplete="name"
          required
          class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          :class="fieldErrors.name ? 'border-red-500' : ''"
        >
        <p v-if="fieldErrors.name" class="mt-1 text-xs text-red-600">
          {{ fieldErrors.name }}
        </p>
      </div>

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
          :class="fieldErrors.phone ? 'border-red-500' : ''"
        >
        <p v-if="fieldErrors.phone" class="mt-1 text-xs text-red-600">
          {{ fieldErrors.phone }}
        </p>
      </div>

      <button
        type="submit"
        :disabled="submitting"
        class="w-full py-3 text-base font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 rounded-md transition"
      >
        {{ submitting ? '更新中…' : '変更を保存' }}
      </button>
    </form>
  </div>
</template>
