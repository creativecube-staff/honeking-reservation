<script setup lang="ts">
import type { Store } from '@prisma/client'
import { staffBaseSchema, resetPasswordSchema, type StaffFormState } from '~~/shared/schemas/staff'
import type { Permission, RoleName } from '~~/shared/permissions'

definePageMeta({ layout: 'admin', requirePermission: 'staff:edit' })

type StaffDetail = {
  id: number
  storeId: number
  name: string
  displayOrder: number
  isActive: boolean
  isAssignable: boolean
  canLogin: boolean
  username: string | null
  role: RoleName | null
  permissions: Permission[]
  createdAt: string
  updatedAt: string
  store: Pick<Store, 'id' | 'name' | 'slug'>
}

const route = useRoute()
const id = Number(route.params.id)
if (!Number.isInteger(id) || id <= 0) {
  throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
}

const { data: staff, error: loadError, refresh } = await useFetch<StaffDetail>(`/api/admin/staff/${id}`)
if (loadError.value) {
  throw createError({ statusCode: 404, statusMessage: 'スタッフが見つかりません' })
}

const { user: currentUser } = useUserSession()
const isSelf = computed(() => staff.value?.id === currentUser.value?.id)

const state = reactive<StaffFormState>({
  storeId: staff.value!.storeId,
  name: staff.value!.name,
  displayOrder: staff.value!.displayOrder,
  isActive: staff.value!.isActive,
  isAssignable: staff.value!.isAssignable,
  canLogin: staff.value!.canLogin,
  username: staff.value!.username ?? '',
  role: staff.value!.role,
  permissions: staff.value!.permissions ?? [],
})

const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)
const formSuccess = ref<string | null>(null)
const submitting = ref(false)
const deleting = ref(false)

async function onSubmit() {
  fieldErrors.value = {}
  formError.value = null
  formSuccess.value = null

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
    formSuccess.value = '保存しました'
    await refresh()
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
    await navigateTo('/dashboard/staff')
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    formError.value = err.data?.statusMessage || err.statusMessage || '無効化に失敗しました'
  }
  finally {
    deleting.value = false
  }
}

// パスワード再設定
const newPassword = ref('')
const passwordError = ref<string | null>(null)
const passwordSuccess = ref<string | null>(null)
const resetting = ref(false)

async function resetPassword() {
  passwordError.value = null
  passwordSuccess.value = null
  const parsed = resetPasswordSchema.safeParse({ password: newPassword.value })
  if (!parsed.success) {
    passwordError.value = parsed.error.issues[0]?.message ?? 'パスワードが不正です'
    return
  }
  resetting.value = true
  try {
    await $fetch(`/api/admin/staff/${id}/password`, { method: 'POST', body: parsed.data })
    passwordSuccess.value = 'パスワードを変更しました'
    newPassword.value = ''
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    passwordError.value = err.data?.statusMessage || err.statusMessage || '変更に失敗しました'
  }
  finally {
    resetting.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        {{ staff?.name }}
      </h1>
      <span v-if="isSelf" class="text-xs text-slate-500">(あなた)</span>
      <span
        v-if="staff && !staff.isActive"
        class="inline-flex items-center text-xs text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-sm"
      >
        無効
      </span>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      <NuxtLink to="/dashboard/staff" class="text-blue-700 hover:text-blue-900 hover:underline">
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
    <UAlert
      v-if="formSuccess"
      color="success"
      icon="i-lucide-check"
      :title="formSuccess"
      class="mb-4"
    />

    <form class="space-y-4" @submit.prevent="onSubmit">
      <AdminStaffFormFields :state="state" :field-errors="fieldErrors" :show-password-field="false" />

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
            to="/dashboard/staff"
            class="px-4 py-2 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
          >
            キャンセル
          </NuxtLink>
        </div>

        <button
          v-if="state.isActive && !isSelf"
          type="button"
          :disabled="submitting || deleting"
          class="px-3 py-1.5 text-sm text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400"
          @click="onDelete"
        >
          {{ deleting ? '無効化中...' : 'このスタッフを無効化' }}
        </button>
      </div>
    </form>

    <!-- パスワード再設定 -->
    <div v-if="staff?.canLogin" class="mt-8 bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div class="px-5 py-3 border-b border-[#dcdcde]">
        <h2 class="text-base font-semibold text-slate-900">
          パスワード再設定
        </h2>
        <p class="text-xs text-slate-600 mt-1">
          新しいパスワードを設定します。本人に直接伝えてください。
        </p>
      </div>

      <div class="p-5 space-y-3">
        <UAlert
          v-if="passwordError"
          color="error"
          icon="i-lucide-triangle-alert"
          :title="passwordError"
        />
        <UAlert
          v-if="passwordSuccess"
          color="success"
          icon="i-lucide-check"
          :title="passwordSuccess"
        />

        <form class="flex items-end gap-2" @submit.prevent="resetPassword">
          <div class="flex-1 max-w-md">
            <label for="newPassword" class="block text-sm font-semibold text-slate-900 mb-1.5">
              新しいパスワード
            </label>
            <input
              id="newPassword"
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500"
            >
          </div>
          <button
            type="submit"
            :disabled="resetting"
            class="px-4 py-2 border border-[#8c8f94] bg-[#f6f7f7] hover:bg-white text-slate-700 text-sm rounded-sm disabled:opacity-50"
          >
            {{ resetting ? '変更中...' : 'パスワードを変更' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
