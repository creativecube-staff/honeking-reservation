<script setup lang="ts">
import type { StoreFormState } from '~~/shared/schemas/store'

// new / 編集 で共有する Store フォームフィールド群（WP 風メタボックス）。
// 4 カラムグリッド配置。指示しやすいよう各フィールドに store-field-* の固有クラスを付与。
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
  <!-- WP 風メタボックス。指示用クラス: 全体=store-form / グリッド=store-form-grid / 各項目=store-field-* -->
  <div class="store-form bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
    <div class="px-5 py-3 border-b border-[#dcdcde]">
      <h2 class="text-base font-semibold text-slate-900">
        基本情報
      </h2>
    </div>

    <!-- 4 カラムグリッド: 1行目=店舗名/スラッグ/電話番号/表示順, 2行目=都道府県/市区町村/住所(2列), 3行目=状態 -->
    <div class="store-form-grid p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-4">
      <!-- 店舗名 -->
      <div class="store-field-name">
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

      <!-- スラッグ -->
      <div class="store-field-slug">
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
          本サイトのスラッグを入力してください
        </p>
        <p v-if="fieldErrors.slug" class="mt-1 text-xs text-red-700">
          {{ fieldErrors.slug }}
        </p>
      </div>

      <!-- 電話番号 -->
      <div class="store-field-phone">
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

      <!-- メールアドレス（連絡先として電話番号の隣。将来のメール連携の入れ物） -->
      <div class="store-field-email">
        <label class="block text-sm font-semibold text-slate-900 mb-1.5">
          メールアドレス
        </label>
        <input
          v-model="s.email"
          type="email"
          autocomplete="off"
          placeholder="例: otakanomori@example.com"
          :class="[baseInput, fieldErrors.email && errInput]"
        >
        <p v-if="fieldErrors.email" class="mt-1 text-xs text-red-700">
          {{ fieldErrors.email }}
        </p>
      </div>

      <!-- 都道府県（1 行目が 4 つ埋まったので、ここから自然に 2 行目） -->
      <div class="store-field-prefecture">
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

      <!-- 市区町村 -->
      <div class="store-field-city">
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

      <!-- 住所（2 列ぶん） -->
      <div class="store-field-address sm:col-span-2">
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

      <!-- 表示順（状態の横） -->
      <div class="store-field-order">
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
          小さい順に表示
        </p>
        <p v-if="fieldErrors.displayOrder" class="mt-1 text-xs text-red-700">
          {{ fieldErrors.displayOrder }}
        </p>
      </div>

      <!-- 状態 -->
      <div class="store-field-active">
        <label class="block text-sm font-semibold text-slate-900 mb-1.5">
          状態
        </label>
        <label class="inline-flex items-center gap-2 text-sm text-slate-900 mt-2 select-none">
          <input
            v-model="s.isActive"
            type="checkbox"
            class="h-4 w-4 border-[#8c8f94] rounded-sm text-orange-500 focus:ring-orange-500"
          >
          有効（お客様側に表示）
        </label>
      </div>
    </div>

    <!-- 追加スロット: 編集ページではベッド管理をこのカード枠内に差し込む（new では未使用） -->
    <div v-if="$slots.extra" class="border-t border-[#dcdcde] px-5 py-4">
      <slot name="extra" />
    </div>
  </div>
</template>
