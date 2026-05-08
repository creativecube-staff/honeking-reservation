<script setup lang="ts">
import type { Holiday } from '@prisma/client'

const props = defineProps<{
  storeId: number
}>()

const { data: holidays, refresh, error } = await useFetch<Holiday[]>(
  () => `/api/admin/stores/${props.storeId}/holidays`,
  { watch: [() => props.storeId] },
)

const newDate = ref('')
const newNote = ref('')
const adding = ref(false)
const addError = ref<string | null>(null)

async function onAdd() {
  addError.value = null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate.value)) {
    addError.value = '日付を選んでください'
    return
  }
  adding.value = true
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/holidays`, {
      method: 'POST',
      body: { date: newDate.value, note: newNote.value || null },
    })
    newDate.value = ''
    newNote.value = ''
    await refresh()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    addError.value = err.data?.statusMessage || err.statusMessage || '追加に失敗しました'
  }
  finally {
    adding.value = false
  }
}

const busy = ref<number | null>(null)

async function onDelete(holiday: Holiday) {
  if (!confirm(`${dateFmt.format(new Date(holiday.date))} の店休日を削除しますか？`)) return
  busy.value = holiday.id
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/holidays/${holiday.id}`, { method: 'DELETE' })
    await refresh()
  }
  finally {
    busy.value = null
  }
}

const dateFmt = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
})

const baseInput = 'px-2.5 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500'
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`店休日の取得に失敗しました: ${error.message}`"
    />

    <!-- 追加フォーム -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm p-4">
      <h3 class="text-sm font-semibold text-slate-900 mb-3">
        店休日を追加
      </h3>
      <div class="flex items-end gap-3 flex-wrap">
        <div>
          <label class="block text-xs font-semibold text-slate-900 mb-1">
            日付 <span class="text-red-600">*</span>
          </label>
          <input v-model="newDate" type="date" :class="baseInput">
        </div>
        <div class="flex-1 min-w-[200px]">
          <label class="block text-xs font-semibold text-slate-900 mb-1">
            メモ（任意）
          </label>
          <input
            v-model="newNote"
            type="text"
            placeholder="例: 年末年始、研修、棚卸しなど"
            :class="[baseInput, 'w-full']"
          >
        </div>
        <button
          type="button"
          :disabled="adding"
          class="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm shadow-sm"
          @click="onAdd"
        >
          {{ adding ? '追加中...' : '+ 追加' }}
        </button>
      </div>
      <p v-if="addError" class="mt-2 text-xs text-red-700">
        {{ addError }}
      </p>
    </div>

    <!-- 既存リスト -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-[#f6f7f7] text-slate-900">
          <tr>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              日付
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              メモ
            </th>
            <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7] w-32">
              アクション
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="(holidays ?? []).length === 0">
            <td colspan="3" class="px-3 py-6 text-center text-slate-500">
              この店舗の店休日はまだ登録されていません。
            </td>
          </tr>
          <tr
            v-for="h in holidays"
            :key="h.id"
            class="border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
          >
            <td class="px-3 py-2.5 font-medium text-slate-900">
              {{ dateFmt.format(new Date(h.date)) }}
            </td>
            <td class="px-3 py-2.5 text-slate-700">
              {{ h.note || '—' }}
            </td>
            <td class="px-3 py-2.5 text-right">
              <button
                type="button"
                :disabled="busy === h.id"
                class="text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400 text-xs"
                @click="onDelete(h)"
              >
                削除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-slate-600">
      店休日に登録した日は予約枠ゼロになります。国民の祝日（全店共通）は別管理です（PublicHoliday）。
    </p>
  </div>
</template>
