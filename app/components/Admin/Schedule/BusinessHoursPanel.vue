<script setup lang="ts">
import type { CalendarColumn, CalendarRange } from '../../Calendar/types'
import type { BusinessHourRangeInput } from '~~/shared/schemas/businessHour'
import { businessHoursBulkSchema } from '~~/shared/schemas/businessHour'

// storeId あり = 既存店舗の編集（API から取得・PUT で保存。親が save()/reset() を呼ぶ）。
// storeId なし = 新規作成の「下書きモード」（API を叩かず initialRanges から編集し、親が getRanges() で取り出す）。
const props = defineProps<{
  storeId?: number
  initialRanges?: BusinessHourRangeInput[]
}>()

// 保存は親（店舗詳細の最下部「更新」ボタン）が制御する。
// 変更有無は update:dirty で親へ通知し、保存/リセットは defineExpose で公開する。
const emit = defineEmits<{ 'update:dirty': [boolean] }>()

type ApiRow = { id: number, dayOfWeek: number, startTime: string, endTime: string }

const { data: apiRows, refresh, error } = await useFetch<ApiRow[]>(
  () => `/api/admin/stores/${props.storeId}/business-hours`,
  // 下書きモード（storeId なし）では API を叩かない
  { watch: [() => props.storeId], immediate: !!props.storeId, default: () => [] as ApiRow[] },
)

// ── 曜日定義（縦カレンダーの列）─────────────────────
const dowLabels = ['日', '月', '火', '水', '木', '金', '土']
const dowHeaderColors = ['text-red-600', '', '', '', '', '', 'text-blue-600']
// 日曜=薄い赤 / 土曜=薄い青の行背景
const dowBgClass = ['bg-red-50', '', '', '', '', '', 'bg-blue-50']
// 月曜はじまり・日曜を最後（土曜の下）に並べる
const dowOrder = [1, 2, 3, 4, 5, 6, 0]

const columns = computed<CalendarColumn[]>(() =>
  dowOrder.map(dow => ({
    id: dow,
    label: dowLabels[dow]!,
    headerClass: dowHeaderColors[dow],
    bgClass: dowBgClass[dow],
  })),
)

// ── ローカル ranges state ─────────────────────────────
let tempCounter = 0
function newId() {
  tempCounter += 1
  return `bh-${tempCounter}`
}

const ranges = ref<CalendarRange[]>([])
const baseline = ref('')

// 比較用に正規化（一時 id は無視し、曜日・時刻でソート）
function serialize(rs: CalendarRange[]): string {
  return JSON.stringify(
    rs.map(r => ({ d: Number(r.columnId), s: r.startTime, e: r.endTime }))
      .sort((a, b) => a.d - b.d || a.s.localeCompare(b.s) || a.e.localeCompare(b.e)),
  )
}

// API データから ranges と baseline を作る（初回ロード / リセット時）
function loadFromApi() {
  ranges.value = (apiRows.value ?? []).map(r => ({
    id: newId(),
    columnId: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
  }))
  baseline.value = serialize(ranges.value)
}
// API モード: apiRows が変わったときだけ再ロード（ranges を依存に含めないため watchEffect は使わない）
watch(apiRows, () => { if (props.storeId) loadFromApi() }, { immediate: true })

// 下書きモード: 初期レンジ（標準営業時間など）から 1 度だけ組み立てる
if (!props.storeId) {
  ranges.value = (props.initialRanges ?? []).map(r => ({
    id: newId(),
    columnId: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
  }))
  baseline.value = serialize(ranges.value)
}

// 変更有無。親へ随時通知する。
const isDirty = computed(() => serialize(ranges.value) !== baseline.value)
watch(isDirty, v => emit('update:dirty', v), { immediate: true })

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

// 親（更新ボタン）から呼ばれる保存。検証/通信に失敗したら例外を投げ、親がエラー表示する。
async function save() {
  const payload: BusinessHourRangeInput[] = ranges.value.map(r => ({
    dayOfWeek: r.columnId as number,
    startTime: r.startTime,
    endTime: r.endTime,
  }))

  const parsed = businessHoursBulkSchema.safeParse({ ranges: payload })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? '営業時間の入力内容を確認してください')
  }

  await $fetch(`/api/admin/stores/${props.storeId}/business-hours`, {
    method: 'PUT',
    body: { ranges: parsed.data.ranges },
  })
  // 再取得すると watch(apiRows) で baseline が更新され、isDirty が false に戻る
  await refresh()
}

// 親（キャンセル等）から呼ばれるリセット
function reset() {
  loadFromApi()
}

// 下書きモードで親（新規作成フォーム）が作成時にレンジを取り出すための getter
function getRanges(): BusinessHourRangeInput[] {
  return ranges.value.map(r => ({
    dayOfWeek: r.columnId as number,
    startTime: r.startTime,
    endTime: r.endTime,
  }))
}

defineExpose({ save, reset, getRanges })
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`営業時間の取得に失敗しました: ${error.message}`"
    />

    <!-- 週間カレンダー（横軸=時刻 / 縦=曜日） -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <CalendarTimeRowCalendar
        v-model:ranges="ranges"
        :columns="columns"
        :hour-start="8"
        :hour-end="22"
        empty-label="店休"
      >
        <template #row-label-actions="{ column }">
          <button
            type="button"
            class="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] text-blue-700 hover:text-blue-900 hover:underline opacity-0 group-hover:opacity-100 whitespace-nowrap"
            title="この曜日を他の全曜日にコピー"
            @click.stop="applyDayToAll(column.id)"
          >
            全曜日へ
          </button>
        </template>
      </CalendarTimeRowCalendar>
    </div>
  </div>
</template>
