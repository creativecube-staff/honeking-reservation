<script setup lang="ts" generic="T extends string">
// ピル形（丸角）タブボタン群。
// 「顧客の会員区分」「予約のステータス」「販売モード」など、
// 「絞り込み」「モード切替」用途で複数箇所に登場するため共通化。
//
// 使い方:
//   <BasePillTabs
//     v-model="status"
//     :items="[
//       { value: 'UPCOMING', label: '予約済', icon: 'i-lucide-calendar-clock' },
//       { value: 'COMPLETED', label: '完了', icon: 'i-lucide-circle-check' },
//     ]"
//   />

export interface PillTabItem<V extends string = string> {
  value: V
  label: string
  icon?: string
}

const props = defineProps<{
  items: PillTabItem<T>[]
  modelValue: T
  /** ホバー時の縁取り色。デフォルトは orange（プロジェクト共通アクセント）。 */
  accent?: 'orange' | 'purple'
}>()

const emit = defineEmits<{ 'update:modelValue': [T] }>()

const accent = computed(() => props.accent ?? 'orange')

const activeClass = computed(() =>
  accent.value === 'purple'
    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
    : 'bg-orange-500 text-white border-orange-500 shadow-sm',
)
const idleClass = computed(() =>
  accent.value === 'purple'
    ? 'bg-white text-slate-700 border-slate-300 hover:border-purple-500 hover:bg-purple-50 hover:text-purple-700'
    : 'bg-white text-slate-700 border-slate-300 hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700',
)

function select(v: T) {
  if (v !== props.modelValue) emit('update:modelValue', v)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors"
      :class="modelValue === item.value ? activeClass : idleClass"
      @click="select(item.value)"
    >
      <UIcon v-if="item.icon" :name="item.icon" class="size-3.5" />
      {{ item.label }}
    </button>
  </div>
</template>
