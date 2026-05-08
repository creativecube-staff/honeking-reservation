<script setup lang="ts">
import type { StoreFormState } from '~~/shared/schemas/store'

// new / 編集 で共有する Store フォームフィールド群（WP 風メタボックス）。
const props = defineProps<{
  state: Partial<StoreFormState>
  fieldErrors: Record<string, string>
}>()

defineEmits<{
  'update:state': [value: Partial<StoreFormState>]
}>()

// 親に reactive を渡してもらっているので、直接 v-model できる
const s = props.state

const baseInput = 'w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_1px_#f97316]'
const errInput = 'border-red-600 focus:border-red-600 focus:shadow-[0_0_0_1px_#dc2626]'
</script>

<template>
  <!-- WP 風メタボックス -->
  <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
    <div class="px-5 py-3 border-b border-[#dcdcde]">
      <h2 class="text-base font-semibold text-slate-900">
        基本情報
      </h2>
    </div>

    <div class="p-5 space-y-5">
      <!-- スラッグ -->
      <div>
        <label class="block text-sm font-semibold text-slate-900 mb-1.5">
          スラッグ <span class="text-red-600">*</span>
        </label>
        <input
          v-model="s.slug"
          type="text"
          autocomplete="off"
          placeholder="例: otakanomori"
          :class="[baseInput, fieldErrors.slug && errInput]"
        >
        <p class="mt-1 text-xs text-slate-600">
          URL に使用されます（半角英数字とハイフンのみ）。例: <code>/reserve/<strong>otakanomori</strong>/menu</code>
        </p>
        <p v-if="fieldErrors.slug" class="mt-1 text-xs text-red-700">
          {{ fieldErrors.slug }}
        </p>
      </div>

      <!-- 都道府県 + 市区町村 -->
      <div class="grid sm:grid-cols-2 gap-5">
        <div>
          <label class="block text-sm font-semibold text-slate-900 mb-1.5">
            都道府県 <span class="text-red-600">*</span>
          </label>
          <input
            v-model="s.prefecture"
            type="text"
            placeholder="例: 千葉県"
            :class="[baseInput, fieldErrors.prefecture && errInput]"
          >
          <p v-if="fieldErrors.prefecture" class="mt-1 text-xs text-red-700">
            {{ fieldErrors.prefecture }}
          </p>
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-900 mb-1.5">
            市区町村 <span class="text-red-600">*</span>
          </label>
          <input
            v-model="s.city"
            type="text"
            placeholder="例: 流山市"
            :class="[baseInput, fieldErrors.city && errInput]"
          >
          <p v-if="fieldErrors.city" class="mt-1 text-xs text-red-700">
            {{ fieldErrors.city }}
          </p>
        </div>
      </div>

      <!-- 店舗名 -->
      <div>
        <label class="block text-sm font-semibold text-slate-900 mb-1.5">
          店舗名 <span class="text-red-600">*</span>
        </label>
        <input
          v-model="s.name"
          type="text"
          placeholder="例: 流山おおたかの森整骨院"
          :class="[baseInput, fieldErrors.name && errInput]"
        >
        <p v-if="fieldErrors.name" class="mt-1 text-xs text-red-700">
          {{ fieldErrors.name }}
        </p>
      </div>

      <!-- 住所 -->
      <div>
        <label class="block text-sm font-semibold text-slate-900 mb-1.5">
          住所 <span class="text-red-600">*</span>
        </label>
        <input
          v-model="s.address"
          type="text"
          placeholder="例: 千葉県流山市おおたかの森南 1-1-1"
          :class="[baseInput, fieldErrors.address && errInput]"
        >
        <p v-if="fieldErrors.address" class="mt-1 text-xs text-red-700">
          {{ fieldErrors.address }}
        </p>
      </div>

      <!-- 電話番号 -->
      <div>
        <label class="block text-sm font-semibold text-slate-900 mb-1.5">
          電話番号
        </label>
        <input
          v-model="s.phone"
          type="text"
          placeholder="例: 04-7100-0000"
          :class="[baseInput, fieldErrors.phone && errInput]"
        >
        <p v-if="fieldErrors.phone" class="mt-1 text-xs text-red-700">
          {{ fieldErrors.phone }}
        </p>
      </div>

      <!-- 表示順 + 状態 -->
      <div class="grid sm:grid-cols-2 gap-5">
        <div>
          <label class="block text-sm font-semibold text-slate-900 mb-1.5">
            表示順 <span class="text-red-600">*</span>
          </label>
          <input
            v-model.number="s.displayOrder"
            type="number"
            min="0"
            max="9999"
            :class="[baseInput, fieldErrors.displayOrder && errInput]"
          >
          <p class="mt-1 text-xs text-slate-600">
            小さい順にソートされます。
          </p>
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
            この店舗を有効にする（お客様側に表示する）
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
