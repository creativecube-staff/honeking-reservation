<script setup lang="ts">
import type { Store } from '@prisma/client'
import type { StaffFormState } from '~~/shared/schemas/staff'

const props = defineProps<{
  state: Partial<StaffFormState>
  fieldErrors: Record<string, string>
}>()

// 店舗一覧（メイン所属店舗の選択肢）
const { data: stores } = await useFetch<Store[]>('/api/admin/stores', {
  query: { status: 'active' },
})

const s = props.state

const baseInput = 'w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_1px_#f97316]'
const errInput = 'border-red-600 focus:border-red-600 focus:shadow-[0_0_0_1px_#dc2626]'
</script>

<template>
  <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
    <div class="px-5 py-3 border-b border-[#dcdcde]">
      <h2 class="text-base font-semibold text-slate-900">
        基本情報
      </h2>
    </div>

    <div class="p-5 space-y-5">
      <!-- メイン所属店舗 -->
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

      <!-- 名前 -->
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

      <!-- 表示順 + 状態 -->
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
        <div>
          <label class="block text-sm font-semibold text-slate-900 mb-1.5">
            状態
          </label>
          <label class="inline-flex items-center gap-2 text-sm text-slate-900 mt-2 select-none">
            <input
              v-model="s.isActive"
              type="checkbox"
              class="h-4 w-4 border-[#8c8f94] rounded-sm text-orange-500 focus:ring-orange-500"
            >
            このスタッフを有効にする
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
