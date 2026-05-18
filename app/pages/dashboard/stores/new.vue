<script setup lang="ts">
import { createStoreSchema, type CreateStoreInput } from '~~/shared/schemas/store'

definePageMeta({ layout: 'admin' })

const state = reactive<CreateStoreInput>({
  slug: '',
  prefecture: '',
  city: '',
  name: '',
  address: '',
  phone: '',
  displayOrder: 0,
  isActive: true,
})

const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  fieldErrors.value = {}
  formError.value = null

  // phone は空文字なら null として送る
  const payload = {
    ...state,
    phone: state.phone && String(state.phone).trim() !== '' ? state.phone : null,
  }

  const parsed = createStoreSchema.safeParse(payload)
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
    await $fetch('/api/admin/stores', { method: 'POST', body: parsed.data })
    await navigateTo('/admin/stores')
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
        新規店舗を追加
      </h1>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      <NuxtLink to="/admin/stores" class="text-blue-700 hover:text-blue-900 hover:underline">
        ← 店舗一覧に戻る
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
      <AdminStoreFormFields
        :state="state"
        :field-errors="fieldErrors"
        @update:state="(v) => Object.assign(state, v)"
      />

      <div class="flex items-center gap-2 pt-2">
        <button
          type="submit"
          :disabled="submitting"
          class="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm shadow-sm"
        >
          {{ submitting ? '保存中...' : '保存' }}
        </button>
        <NuxtLink
          to="/admin/stores"
          class="px-4 py-2 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
        >
          キャンセル
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
