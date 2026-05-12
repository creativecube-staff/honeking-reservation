<script setup lang="ts">
import type { Store } from '@prisma/client'
import type { StaffFormState } from '~~/shared/schemas/staff'
import { ALL_PERMISSIONS, PERMISSION_LABEL, ROLES, ROLE_DEFAULT_PERMISSIONS, ROLE_LABEL, type Permission, type RoleName } from '~~/shared/permissions'

// state は new.vue / [id].vue から渡される reactive オブジェクト。
// canLogin / username / role / permissions / isAssignable をここで編集する。
// 新規作成のみ password を扱う（編集は別 API: /staff/:id/password）。
const props = defineProps<{
  state: Partial<StaffFormState & { password?: string }>
  fieldErrors: Record<string, string>
  showPasswordField?: boolean
}>()

// 店舗一覧（メイン所属店舗の選択肢）
const { data: stores } = await useFetch<Store[]>('/api/admin/stores', {
  query: { status: 'active' },
})

const s = props.state

const roleDefaults = computed<Permission[]>(() => {
  const r = s.role as RoleName | null | undefined
  return r ? ROLE_DEFAULT_PERMISSIONS[r] : []
})

const currentRoleLabel = computed<string>(() => {
  const r = s.role as RoleName | null | undefined
  return r ? ROLE_LABEL[r] : ''
})

const baseInput = 'w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_1px_#f97316]'
const errInput = 'border-red-600 focus:border-red-600 focus:shadow-[0_0_0_1px_#dc2626]'
</script>

<template>
  <div class="space-y-6">
    <!-- 基本情報 -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div class="px-5 py-3 border-b border-[#dcdcde]">
        <h2 class="text-base font-semibold text-slate-900">
          基本情報
        </h2>
      </div>

      <div class="p-5 space-y-5">
        <div>
          <label class="block text-sm font-semibold text-slate-900 mb-1.5">
            メイン所属店舗 <span class="text-red-600">*</span>
          </label>
          <select
            v-model.number="s.storeId"
            :class="[baseInput, fieldErrors.storeId && errInput]"
          >
            <option :value="undefined" disabled>
              -- 店舗を選択 --
            </option>
            <option
              v-for="store in stores ?? []"
              :key="store.id"
              :value="store.id"
            >
              {{ store.name }}
            </option>
          </select>
          <p class="mt-1 text-xs text-slate-600">
            普段勤務する店舗です。シフトで日単位の他店舗ヘルプを指定できます。
          </p>
          <p v-if="fieldErrors.storeId" class="mt-1 text-xs text-red-700">
            {{ fieldErrors.storeId }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-semibold text-slate-900 mb-1.5">
            スタッフ名 <span class="text-red-600">*</span>
          </label>
          <input
            v-model="s.name"
            type="text"
            placeholder="例: 田中 健太"
            :class="[baseInput, fieldErrors.name && errInput]"
          >
          <p v-if="fieldErrors.name" class="mt-1 text-xs text-red-700">
            {{ fieldErrors.name }}
          </p>
        </div>

        <div class="grid sm:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-semibold text-slate-900 mb-1.5">
              表示順
            </label>
            <input
              v-model.number="s.displayOrder"
              type="number"
              min="0"
              max="9999"
              :class="[baseInput, fieldErrors.displayOrder && errInput]"
            >
            <p v-if="fieldErrors.displayOrder" class="mt-1 text-xs text-red-700">
              {{ fieldErrors.displayOrder }}
            </p>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-semibold text-slate-900 mb-1.5">
              状態
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-900 select-none">
              <input
                v-model="s.isActive"
                type="checkbox"
                class="h-4 w-4 border-[#8c8f94] rounded-sm text-orange-500 focus:ring-orange-500"
              >
              このスタッフを有効にする
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-900 select-none">
              <input
                v-model="s.isAssignable"
                type="checkbox"
                class="h-4 w-4 border-[#8c8f94] rounded-sm text-orange-500 focus:ring-orange-500"
              >
              予約に割り当てる（施術するスタッフ）
            </label>
            <p class="text-xs text-slate-600">
              受付・経理など施術をしないスタッフはチェックを外してください。
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- ログイン情報 -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div class="px-5 py-3 border-b border-[#dcdcde]">
        <h2 class="text-base font-semibold text-slate-900">
          ログイン情報・権限
        </h2>
        <p class="text-xs text-slate-600 mt-1">
          このスタッフが管理画面にログインできるようにするかを設定します。
        </p>
      </div>

      <div class="p-5 space-y-5">
        <label class="flex items-center gap-2 text-sm text-slate-900 select-none">
          <input
            v-model="s.canLogin"
            type="checkbox"
            class="h-4 w-4 border-[#8c8f94] rounded-sm text-orange-500 focus:ring-orange-500"
          >
          このスタッフが管理画面にログインできるようにする
        </label>

        <template v-if="s.canLogin">
          <div>
            <label class="block text-sm font-semibold text-slate-900 mb-1.5">
              ユーザー名（ログイン ID）<span class="text-red-600">*</span>
            </label>
            <input
              v-model="s.username"
              type="text"
              autocomplete="off"
              placeholder="半角英数 / _ / -"
              :class="[baseInput, fieldErrors.username && errInput]"
            >
            <p class="mt-1 text-xs text-slate-600">
              3〜32 文字。ログイン後の変更は推奨しません。
            </p>
            <p v-if="fieldErrors.username" class="mt-1 text-xs text-red-700">
              {{ fieldErrors.username }}
            </p>
          </div>

          <div v-if="showPasswordField">
            <label class="block text-sm font-semibold text-slate-900 mb-1.5">
              初期パスワード <span class="text-red-600">*</span>
            </label>
            <input
              v-model="s.password"
              type="password"
              autocomplete="new-password"
              :class="[baseInput, fieldErrors.password && errInput]"
            >
            <p class="mt-1 text-xs text-slate-600">
              8〜128 文字。本人に直接伝え、初回ログイン後に変更してもらってください。
            </p>
            <p v-if="fieldErrors.password" class="mt-1 text-xs text-red-700">
              {{ fieldErrors.password }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-900 mb-1.5">
              役職 <span class="text-red-600">*</span>
            </label>
            <select
              v-model="s.role"
              :class="[baseInput, fieldErrors.role && errInput]"
            >
              <option :value="null" disabled>
                -- 役職を選択 --
              </option>
              <option v-for="r in ROLES" :key="r" :value="r">
                {{ ROLE_LABEL[r] }}
              </option>
            </select>
            <p class="mt-1 text-xs text-slate-600">
              役職を選ぶと、その役職の基本権限が自動付与されます。
            </p>
            <p v-if="fieldErrors.role" class="mt-1 text-xs text-red-700">
              {{ fieldErrors.role }}
            </p>
          </div>

          <div v-if="roleDefaults.length > 0">
            <p class="block text-sm font-semibold text-slate-900 mb-2">
              役職「{{ currentRoleLabel }}」のデフォルト権限
            </p>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="p in roleDefaults"
                :key="p"
                class="text-xs text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-sm"
              >
                {{ PERMISSION_LABEL[p] }}
              </span>
            </div>
          </div>

          <div>
            <p class="block text-sm font-semibold text-slate-900 mb-2">
              追加権限（任意）
            </p>
            <p class="text-xs text-slate-600 mb-2">
              役職のデフォルト権限に加えて、個別に上乗せできます。
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <label
                v-for="p in ALL_PERMISSIONS"
                :key="p"
                class="flex items-center gap-2 text-sm text-slate-700"
              >
                <input
                  v-model="s.permissions"
                  type="checkbox"
                  :value="p"
                  :disabled="roleDefaults.includes(p)"
                  class="h-4 w-4 border-[#8c8f94] rounded-sm text-orange-500 focus:ring-orange-500 disabled:opacity-50"
                >
                <span :class="roleDefaults.includes(p) ? 'text-slate-400 line-through' : ''">
                  {{ PERMISSION_LABEL[p] }}
                </span>
              </label>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
