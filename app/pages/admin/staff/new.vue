<script setup lang="ts">
import { createStaffSchema, type StaffFormState } from '~~/shared/schemas/staff'

definePageMeta({ layout: 'admin' })

const state = reactive<Partial<StaffFormState>>({
  storeId: undefined,
  name: '',
  displayOrder: 0,
  isActive: true,
})

const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  fieldErrors.value = {}
  formError.value = null

  const parsed = createStaffSchema.safeParse(state)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (!errors[key]) errors[key] = issue.message
    }
    fieldErrors.value = errors
    formError.value = '入力内容を確認してください'
    return
  }

  submitting.value = true
  try {
    await $fetch('/api/admin/staff', { method: 'POST', body: parsed.data })
    await navigateTo('/admin/staff')
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    formError.value = err.data?.statusMessage || err.statusMessage || '登録に失敗しました'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        新規スタッフを追加
      </h1>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      <NuxtLink to="/admin/staff" class="text-blue-700 hover:text-blue-900 hover:underline">
        ← スタッフ一覧に戻る
      </NuxtLink>
    </p>

    <UAlert
      v-if="formError"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="formError"
      class="mb-4"
    />

    <form class="space-y-4" @submit.prevent="onSubmit">
      <AdminStaffFormFields :state="state" :field-errors="fieldErrors" />

      <div class="flex items-center gap-2 pt-2">
        <button
          type="submit"
          :disabled="submitting"
          class="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm shadow-sm"
        >
          {{ submitting ? '保存中...' : '保存' }}
        </button>
        <NuxtLink
          to="/admin/staff"
          class="px-4 py-2 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
        >
          キャンセル
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
