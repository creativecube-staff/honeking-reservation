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

// 編集ステート（7 行、dayOfWeek 0..6）
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
const dowColors = ['text-red-600', '', '', '', '', '', 'text-blue-600']

// ── 時刻ヘルパー ──────────────────────────────────────
function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  if (h == null || m == null) return null
  return h * 60 + m
}

// 週間プレビューの時刻範囲（6:00 - 22:00、1 時間 = 36px、合計 576px）
const HOUR_START = 6
const HOUR_END = 22
const HOUR_PX = 36
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i)
const TOTAL_H = (HOUR_END - HOUR_START) * HOUR_PX

function rangeStyle(start: string | null, end: string | null) {
  const s = toMinutes(start)
  const e = toMinutes(end)
  if (s == null || e == null) return null
  const top = ((s - HOUR_START * 60) * HOUR_PX) / 60
  const height = ((e - s) * HOUR_PX) / 60
  return { top: `${top}px`, height: `${height}px` }
}

function isOpenDay(row: BusinessHourInput) {
  // 開店・閉店が両方入っていれば営業日とみなす（空欄 = 店休）
  return !!row.openTime && !!row.closeTime
}

function hasBreak(row: BusinessHourInput) {
  return !!row.breakStartTime && !!row.breakEndTime
}

// ── 保存 ──────────────────────────────────────────────
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})
const saving = ref(false)
const savedAt = ref<string | null>(null)

async function onSave() {
  formError.value = null
  fieldErrors.value = {}

  // 開店・閉店が空欄なら自動で店休扱い（isClosed=true、時刻 null）
  const normalized: BusinessHourInput[] = rows.map((r) => {
    const open = r.openTime?.trim() || null
    const close = r.closeTime?.trim() || null
    const closed = !open || !close
    return {
      dayOfWeek: r.dayOfWeek,
      isClosed: closed,
      openTime: closed ? null : open,
      closeTime: closed ? null : close,
      breakStartTime: closed ? null : (r.breakStartTime?.trim() || null),
      breakEndTime: closed ? null : (r.breakEndTime?.trim() || null),
    }
  })

  const parsed = businessHoursBulkSchema.safeParse({ hours: normalized })
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

    <!-- 週間プレビュー（横軸 曜日 × 縦軸 時刻、Google カレンダー風） -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div class="px-4 py-2.5 border-b border-[#dcdcde] flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-900">
          週間プレビュー
        </h3>
        <p class="text-xs text-slate-500">
          オレンジ = 営業時間、グレー縞 = 休憩、空欄 = 店休
        </p>
      </div>

      <div class="flex select-none">
        <!-- 時刻ラベル列 -->
        <div class="w-12 flex-shrink-0 border-r border-[#dcdcde]">
          <!-- 曜日ヘッダー分の空きスペース -->
          <div class="h-7 border-b border-[#dcdcde]" />
          <div class="relative" :style="{ height: `${TOTAL_H}px` }">
            <div
              v-for="h in HOURS"
              :key="h"
              class="absolute left-0 right-0 text-[10px] text-slate-500 pr-1 text-right -translate-y-1.5"
              :style="{ top: `${(h - HOUR_START) * HOUR_PX}px` }"
            >
              {{ String(h).padStart(2, '0') }}:00
            </div>
          </div>
        </div>

        <!-- 7 曜日列 -->
        <div class="grid grid-cols-7 flex-1">
          <div
            v-for="(row, i) in rows"
            :key="row.dayOfWeek"
            class="border-r border-[#dcdcde] last:border-r-0"
          >
            <!-- 曜日ヘッダー -->
            <div
              class="h-7 border-b border-[#dcdcde] flex items-center justify-center text-xs font-semibold"
              :class="dowColors[row.dayOfWeek]"
            >
              {{ dowLabels[row.dayOfWeek] }}
            </div>

            <!-- 時刻グリッド + 営業バー -->
            <div class="relative" :style="{ height: `${TOTAL_H}px` }">
              <!-- 時刻横線（1 時間ごと） -->
              <div
                v-for="h in HOURS"
                :key="h"
                class="absolute left-0 right-0 border-t border-dashed border-[#f0f0f1]"
                :style="{ top: `${(h - HOUR_START) * HOUR_PX}px` }"
              />

              <!-- 店休（営業時間が両方空） -->
              <div
                v-if="!isOpenDay(row)"
                class="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 bg-[repeating-linear-gradient(45deg,_transparent,_transparent_6px,_#f6f7f7_6px,_#f6f7f7_12px)]"
              >
                店休
              </div>

              <!-- 営業時間バー -->
              <div
                v-if="isOpenDay(row) && rangeStyle(row.openTime, row.closeTime)"
                class="absolute left-0.5 right-0.5 bg-orange-100 border border-orange-400 rounded-sm overflow-hidden"
                :style="rangeStyle(row.openTime, row.closeTime) ?? {}"
              >
                <div class="text-[9px] text-orange-900 font-semibold px-1 py-0.5 leading-tight tabular-nums">
                  {{ row.openTime }}<br>{{ row.closeTime }}
                </div>
              </div>

              <!-- 休憩バー（重ねる） -->
              <div
                v-if="isOpenDay(row) && hasBreak(row) && rangeStyle(row.breakStartTime, row.breakEndTime)"
                class="absolute left-0.5 right-0.5 border border-slate-400 rounded-sm overflow-hidden bg-[repeating-linear-gradient(45deg,_transparent,_transparent_3px,_#cbd5e1_3px,_#cbd5e1_6px)]"
                :style="rangeStyle(row.breakStartTime, row.breakEndTime) ?? {}"
              >
                <div class="text-[9px] text-slate-700 font-semibold px-1 py-0.5 leading-tight tabular-nums">
                  休
                </div>
              </div>

              <!-- 「他の曜日にコピー」ボタン（フッター下に） -->
              <button
                v-if="isOpenDay(row)"
                type="button"
                class="absolute bottom-1 left-0.5 right-0.5 text-[9px] text-blue-700 hover:text-blue-900 hover:underline"
                @click="applyToAll(i)"
              >
                他にコピー
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 時刻入力テーブル（編集 UI） -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
      <div class="px-4 py-2.5 border-b border-[#dcdcde]">
        <h3 class="text-sm font-semibold text-slate-900">
          時刻を編集
        </h3>
        <p class="text-xs text-slate-600 mt-0.5">
          開店・閉店を空欄にすると<strong>店休扱い</strong>になります。
        </p>
      </div>
      <table class="w-full text-sm">
        <thead class="bg-[#f6f7f7] text-slate-900">
          <tr>
            <th class="px-3 py-2 text-left font-semibold border-b border-[#dcdcde] w-16">
              曜日
            </th>
            <th class="px-3 py-2 text-left font-semibold border-b border-[#dcdcde]">
              開店
            </th>
            <th class="px-3 py-2 text-left font-semibold border-b border-[#dcdcde]">
              閉店
            </th>
            <th class="px-3 py-2 text-left font-semibold border-b border-[#dcdcde]">
              休憩開始
            </th>
            <th class="px-3 py-2 text-left font-semibold border-b border-[#dcdcde]">
              休憩終了
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.dayOfWeek"
            class="border-b border-[#f0f0f1] last:border-b-0"
          >
            <td class="px-3 py-2 font-semibold" :class="dowColors[row.dayOfWeek]">
              {{ dowLabels[row.dayOfWeek] }}
            </td>
            <td class="px-3 py-2">
              <input
                v-model="row.openTime"
                type="time"
                step="900"
                :class="baseInput"
              >
            </td>
            <td class="px-3 py-2">
              <input
                v-model="row.closeTime"
                type="time"
                step="900"
                :class="baseInput"
              >
            </td>
            <td class="px-3 py-2">
              <input
                v-model="row.breakStartTime"
                type="time"
                step="900"
                :disabled="!isOpenDay(row)"
                :class="[baseInput, !isOpenDay(row) && 'bg-slate-50 text-slate-400']"
              >
            </td>
            <td class="px-3 py-2">
              <input
                v-model="row.breakEndTime"
                type="time"
                step="900"
                :disabled="!isOpenDay(row)"
                :class="[baseInput, !isOpenDay(row) && 'bg-slate-50 text-slate-400']"
              >
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
