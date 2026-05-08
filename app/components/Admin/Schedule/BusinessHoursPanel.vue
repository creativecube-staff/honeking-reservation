<script setup lang="ts">
import type { CalendarColumn, CalendarRange } from '../../Calendar/types'
import type { BusinessHourRangeInput } from '~~/shared/schemas/businessHour'
import { businessHoursBulkSchema } from '~~/shared/schemas/businessHour'

const props = defineProps<{
  storeId: number
}>()

type ApiRow = { id: number, dayOfWeek: number, startTime: string, endTime: string }

const { data: apiRows, refresh, error } = await useFetch<ApiRow[]>(
  () => `/api/admin/stores/${props.storeId}/business-hours`,
  { watch: [() => props.storeId] },
)

// ── 曜日定義（縦カレンダーの列）─────────────────────
const dowLabels = ['日', '月', '火', '水', '木', '金', '土']
const dowHeaderColors = ['text-red-600', '', '', '', '', '', 'text-blue-600']

const columns = computed<CalendarColumn[]>(() =>
  Array.from({ length: 7 }, (_, dow) => ({
    id: dow,
    label: dowLabels[dow]!,
    headerClass: dowHeaderColors[dow],
  })),
)

// ── ローカル ranges state ─────────────────────────────
let tempCounter = 0
function newId() {
  tempCounter += 1
  return `bh-${tempCounter}`
}

const ranges = ref<CalendarRange[]>([])

watchEffect(() => {
  ranges.value = (apiRows.value ?? []).map(r => ({
    id: newId(),
    columnId: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
  }))
})

// ── 「他の曜日にコピー」 ────────────────────────────────
function applyDayToAll(columnId: string | number) {
  const dow = Number(columnId)
  const src = ranges.value.filter(r => r.columnId === dow)
  const next = ranges.value.filter(r => r.columnId === dow) // 自分の曜日はそのまま
  for (let other = 0; other < 7; other++) {
    if (other === dow) continue
    for (const r of src) {
      next.push({
        id: newId(),
        columnId: other,
        startTime: r.startTime,
        endTime: r.endTime,
      })
    }
  }
  ranges.value = next
}

// ── 保存 ──────────────────────────────────────────────
const formError = ref<string | null>(null)
const saving = ref(false)
const savedAt = ref<string | null>(null)

async function onSave() {
  formError.value = null

  const payload: BusinessHourRangeInput[] = ranges.value.map(r => ({
    dayOfWeek: r.columnId as number,
    startTime: r.startTime,
    endTime: r.endTime,
  }))

  const parsed = businessHoursBulkSchema.safeParse({ ranges: payload })
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message ?? '入力内容を確認してください'
    return
  }

  saving.value = true
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/business-hours`, {
      method: 'PUT',
      body: { ranges: parsed.data.ranges },
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
</script>

<template>
  <div class="space-y-4">
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

    <!-- 操作ヒント -->
    <div class="bg-blue-50 border border-blue-200 px-3 py-2 rounded-sm text-xs text-blue-900 leading-relaxed">
      <strong>操作:</strong>
      空白部分を縦にドラッグ → 営業レンジを新規作成 ／
      バーを掴んで移動 ／ バーの<strong>上下端</strong>を掴んでリサイズ ／
      バー右上の <span class="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white border border-orange-400 text-orange-700 text-[10px] font-bold align-middle">×</span> で削除。
      中抜け休憩は <strong>2 つのレンジ</strong>で表現します（例: 9:30-12:30 と 15:00-20:30）。
      レンジが 0 件 = 店休日。15 分単位でスナップします。
    </div>

    <!-- 週間カレンダー -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div class="px-4 py-2.5 border-b border-[#dcdcde] flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-900">
          営業時間
        </h3>
        <p class="text-xs text-slate-500">
          ドラッグ&ドロップで編集
        </p>
      </div>

      <TimeColumnCalendar
        v-model:ranges="ranges"
        :columns="columns"
        empty-label="店休"
      >
        <template #column-header-actions="{ column }">
          <button
            type="button"
            class="absolute right-0.5 text-[9px] text-blue-700 hover:text-blue-900 hover:underline opacity-0 group-hover:opacity-100"
            title="この曜日を他の全曜日にコピー"
            @click="applyDayToAll(column.id)"
          >
            全曜日へ
          </button>
        </template>
      </TimeColumnCalendar>
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
