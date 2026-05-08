<script setup lang="ts">
import type { BusinessHourInput } from '~~/shared/schemas/businessHour'
import { businessHoursBulkSchema } from '~~/shared/schemas/businessHour'

const props = defineProps<{
  storeId: number
}>()

type ApiRow = BusinessHourInput & { id: number | null }

const { data: hours, refresh, error } = await useFetch<ApiRow[]>(
  () => `/api/admin/stores/${props.storeId}/business-hours`,
  { watch: [() => props.storeId] },
)

// 編集ステート（7 行）
const rows = reactive<BusinessHourInput[]>([])

watchEffect(() => {
  rows.length = 0
  for (const r of hours.value ?? []) {
    rows.push({
      dayOfWeek: r.dayOfWeek,
      isClosed: r.isClosed,
      openTime: r.openTime,
      closeTime: r.closeTime,
      breakStartTime: r.breakStartTime,
      breakEndTime: r.breakEndTime,
    })
  }
})

const dowLabels = ['日', '月', '火', '水', '木', '金', '土']

const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})
const saving = ref(false)
const savedAt = ref<string | null>(null)

async function onSave() {
  formError.value = null
  fieldErrors.value = {}

  const parsed = businessHoursBulkSchema.safeParse({ hours: rows })
  if (!parsed.success) {
    const errs: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (!errs[key]) errs[key] = issue.message
    }
    fieldErrors.value = errs
    formError.value = '入力内容を確認してください'
    return
  }

  saving.value = true
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/business-hours`, {
      method: 'PUT',
      body: { hours: parsed.data.hours },
    })
    savedAt.value = new Date().toLocaleTimeString('ja-JP')
    await refresh()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    formError.value = err.data?.statusMessage || err.statusMessage || '保存に失敗しました'
  }
  finally {
    saving.value = false
  }
}

function applyToAll(srcIndex: number) {
  const src = rows[srcIndex]
  if (!src) return
  for (let i = 0; i < rows.length; i++) {
    if (i === srcIndex) continue
    rows[i] = { ...rows[i]!, ...src, dayOfWeek: rows[i]!.dayOfWeek }
  }
}

const baseInput = 'px-2 py-1 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500'
</script>

<template>
  <div class="space-y-3">
    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`営業時間の取得に失敗しました: ${error.message}`"
    />

    <UAlert
      v-if="formError"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="formError"
    />

    <div v-if="savedAt" class="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-sm">
      ✓ {{ savedAt }} に保存しました
    </div>

    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-[#f6f7f7] text-slate-900">
          <tr>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] w-16">
              曜日
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] w-24">
              営業
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              開店
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              閉店
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              休憩開始
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              休憩終了
            </th>
            <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7] w-32" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in rows"
            :key="row.dayOfWeek"
            class="border-b border-[#f0f0f1] last:border-b-0"
          >
            <td class="px-3 py-2.5 font-semibold text-slate-900">
              {{ dowLabels[row.dayOfWeek] }}
            </td>
            <td class="px-3 py-2.5">
              <label class="inline-flex items-center gap-1.5 text-sm select-none">
                <input
                  v-model="row.isClosed"
                  type="checkbox"
                  class="h-4 w-4 border-[#8c8f94] rounded-sm text-orange-500 focus:ring-orange-500"
                >
                <span class="text-xs text-slate-700">店休</span>
              </label>
            </td>
            <td class="px-3 py-2.5">
              <input
                v-model="row.openTime"
                type="time"
                step="900"
                :disabled="row.isClosed"
                :class="[baseInput, row.isClosed && 'bg-slate-50 text-slate-400']"
              >
            </td>
            <td class="px-3 py-2.5">
              <input
                v-model="row.closeTime"
                type="time"
                step="900"
                :disabled="row.isClosed"
                :class="[baseInput, row.isClosed && 'bg-slate-50 text-slate-400']"
              >
            </td>
            <td class="px-3 py-2.5">
              <input
                v-model="row.breakStartTime"
                type="time"
                step="900"
                :disabled="row.isClosed"
                :class="[baseInput, row.isClosed && 'bg-slate-50 text-slate-400']"
              >
            </td>
            <td class="px-3 py-2.5">
              <input
                v-model="row.breakEndTime"
                type="time"
                step="900"
                :disabled="row.isClosed"
                :class="[baseInput, row.isClosed && 'bg-slate-50 text-slate-400']"
              >
            </td>
            <td class="px-3 py-2.5 text-right">
              <button
                type="button"
                class="text-xs text-blue-700 hover:text-blue-900 hover:underline"
                @click="applyToAll(i)"
              >
                他の曜日にコピー
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-end pt-2">
      <button
        type="button"
        :disabled="saving"
        class="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm shadow-sm"
        @click="onSave"
      >
        {{ saving ? '保存中...' : '営業時間を保存' }}
      </button>
    </div>
  </div>
</template>
