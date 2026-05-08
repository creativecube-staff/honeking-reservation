<script setup lang="ts">
import type { Practitioner, Store } from '@prisma/client'
import { staffBaseSchema, type StaffFormState } from '~~/shared/schemas/staff'

definePageMeta({ layout: 'admin' })

type StaffWithStore = Practitioner & { store: Pick<Store, 'id' | 'name' | 'slug'> }

const route = useRoute()
const id = Number(route.params.id)
if (!Number.isInteger(id) || id <= 0) {
  throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
}

const { data: staff, error: loadError } = await useFetch<StaffWithStore>(`/api/admin/staff/${id}`)
if (loadError.value) {
  throw createError({ statusCode: 404, statusMessage: 'スタッフが見つかりません' })
}

const state = reactive<StaffFormState>({
  storeId: staff.value!.storeId,
  name: staff.value!.name,
  displayOrder: staff.value!.displayOrder,
  isActive: staff.value!.isActive,
})

const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)
const submitting = ref(false)
const deleting = ref(false)

async function onSubmit() {
  fieldErrors.value = {}
  formError.value = null

  const parsed = staffBaseSchema.safeParse(state)
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
    await $fetch(`/api/admin/staff/${id}`, { method: 'PATCH', body: parsed.data })
    await navigateTo('/admin/staff')
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    formError.value = err.data?.statusMessage || err.statusMessage || '保存に失敗しました'
  }
  finally {
    submitting.value = false
  }
}

async function onDelete() {
  if (!confirm(`スタッフ「${state.name}」を無効化しますか？`)) return
  deleting.value = true
  try {
    await $fetch(`/api/admin/staff/${id}`, { method: 'DELETE' })
    await navigateTo('/admin/staff')
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        {{ staff?.name }}
      </h1>
      <span
        v-if="staff && !staff.isActive"
        class="inline-flex items-center text-xs text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-sm"
      >
        無効
      </span>
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

      <div class="flex items-center justify-between pt-2">
        <div class="flex items-center gap-2">
          <button
            type="submit"
            :disabled="submitting || deleting"
            class="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm shadow-sm"
          >
            {{ submitting ? '保存中...' : '更新' }}
          </button>
          <NuxtLink
            to="/admin/staff"
            class="px-4 py-2 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
          >
            キャンセル
          </NuxtLink>
        </div>

        <button
          v-if="state.isActive"
          type="button"
          :disabled="submitting || deleting"
          class="px-3 py-1.5 text-sm text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400"
          @click="onDelete"
        >
          {{ deleting ? '無効化中...' : 'このスタッフを無効化' }}
        </button>
      </div>
    </form>
  </div>
</template>
