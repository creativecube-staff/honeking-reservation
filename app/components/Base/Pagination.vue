<script setup lang="ts">
// 「← 前 / N / N / 次 →」のシンプルなページネーション。
// 一覧画面（顧客 / 予約 / 売上など）の下に共通配置するため切り出し。
//
// 使い方:
//   <BasePagination v-model:page="pageNum" :total-pages="data?.totalPages ?? 1" />

const props = defineProps<{
  page: number
  totalPages: number
}>()

const emit = defineEmits<{ 'update:page': [number] }>()

function go(p: number) {
  if (p < 1) return
  if (p > props.totalPages) return
  if (p === props.page) return
  emit('update:page', p)
}
</script>

<template>
  <div v-if="totalPages > 1" class="mt-4 flex items-center justify-center gap-2">
    <button
      type="button"
      class="px-3 py-1.5 text-sm rounded-sm border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
      :disabled="page <= 1"
      @click="go(page - 1)"
    >
      ← 前
    </button>
    <span class="text-sm tabular-nums text-slate-700">
      {{ page }} / {{ totalPages }}
    </span>
    <button
      type="button"
      class="px-3 py-1.5 text-sm rounded-sm border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
      :disabled="page >= totalPages"
      @click="go(page + 1)"
    >
      次 →
    </button>
  </div>
</template>
