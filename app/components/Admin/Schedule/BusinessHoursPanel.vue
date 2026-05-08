<script setup lang="ts">
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

// ── 時刻ヘルパー ──────────────────────────────────────
// 週間プレビューの時刻範囲（7:00 - 22:00、1 時間 = 36px、合計 540px）
const HOUR_START = 7
const HOUR_END = 22
const HOUR_PX = 36
const SNAP_MIN = 15
const MIN_DURATION_MIN = 15
const HANDLE_PX = 8 // バー上下端のリサイズハンドル領域
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i)
const TOTAL_H = (HOUR_END - HOUR_START) * HOUR_PX

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}
function toTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
function snap(min: number): number {
  return Math.round(min / SNAP_MIN) * SNAP_MIN
}
function clampWindow(min: number): number {
  return Math.max(HOUR_START * 60, Math.min(HOUR_END * 60, min))
}
function yToMinutes(y: number): number {
  return clampWindow(snap(HOUR_START * 60 + Math.round((y / HOUR_PX) * 60)))
}
function minutesToTop(min: number): number {
  return ((min - HOUR_START * 60) * HOUR_PX) / 60
}

// ── ローカル state ─────────────────────────────────────
type LocalRange = { tempId: string, dayOfWeek: number, startTime: string, endTime: string }

let tempIdCounter = 0
function newTempId(): string {
  tempIdCounter += 1
  return `t${tempIdCounter}`
}

const ranges = reactive<LocalRange[]>([])

watchEffect(() => {
  ranges.length = 0
  for (const r of apiRows.value ?? []) {
    ranges.push({
      tempId: newTempId(),
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
    })
  }
})

const dowLabels = ['日', '月', '火', '水', '木', '金', '土']
const dowHeaderColors = ['text-red-600', '', '', '', '', '', 'text-blue-600']

function rangesOfDay(dow: number): LocalRange[] {
  return ranges.filter(r => r.dayOfWeek === dow).sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
}

// ── 衝突回避ヘルパー ────────────────────────────────────
// 指定 dow で「自分以外」のレンジを返す
function othersOfDay(dow: number, selfTempId: string | null): LocalRange[] {
  return ranges.filter(r => r.dayOfWeek === dow && r.tempId !== selfTempId)
}
// dow の他レンジに対して「value 以下で最大の endTime」を返す（startTime の下限になる）
function maxEndBelow(dow: number, selfTempId: string | null, value: number): number {
  let result = HOUR_START * 60
  for (const o of othersOfDay(dow, selfTempId)) {
    const oe = toMinutes(o.endTime)
    if (oe <= value && oe > result) result = oe
  }
  return result
}
// dow の他レンジに対して「value 以上で最小の startTime」を返す（endTime の上限になる）
function minStartAbove(dow: number, selfTempId: string | null, value: number): number {
  let result = HOUR_END * 60
  for (const o of othersOfDay(dow, selfTempId)) {
    const os = toMinutes(o.startTime)
    if (os >= value && os < result) result = os
  }
  return result
}

// ── ドラッグ state ─────────────────────────────────────
type DragState =
  | { kind: 'move', tempId: string, originStartMin: number, originEndMin: number, anchorY: number }
  | { kind: 'resize-top', tempId: string, originEndMin: number }
  | { kind: 'resize-bottom', tempId: string, originStartMin: number }
  | { kind: 'create', dayOfWeek: number, anchorMin: number, tempId: string }

const drag = ref<DragState | null>(null)
const columnRefs = new Map<number, HTMLElement>()

function setColumnRef(dow: number) {
  return (el: Element | { $el: Element } | null) => {
    if (!el) {
      columnRefs.delete(dow)
      return
    }
    const node = (el as { $el?: Element }).$el ?? el
    columnRefs.set(dow, node as HTMLElement)
  }
}

function getYInColumn(e: PointerEvent, dow: number): number {
  const col = columnRefs.get(dow)
  if (!col) return 0
  const rect = col.getBoundingClientRect()
  return e.clientY - rect.top
}

function findRange(tempId: string): LocalRange | undefined {
  return ranges.find(r => r.tempId === tempId)
}

// ── バー操作 ──────────────────────────────────────────
function onBarPointerDown(e: PointerEvent, r: LocalRange, mode: 'move' | 'resize-top' | 'resize-bottom') {
  e.stopPropagation()
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)

  const startMin = toMinutes(r.startTime)
  const endMin = toMinutes(r.endTime)
  if (mode === 'move') {
    drag.value = {
      kind: 'move',
      tempId: r.tempId,
      originStartMin: startMin,
      originEndMin: endMin,
      anchorY: getYInColumn(e, r.dayOfWeek),
    }
  }
  else if (mode === 'resize-top') {
    drag.value = { kind: 'resize-top', tempId: r.tempId, originEndMin: endMin }
  }
  else {
    drag.value = { kind: 'resize-bottom', tempId: r.tempId, originStartMin: startMin }
  }
}

// ── 列空白からの新規作成 ─────────────────────────────
function onColumnPointerDown(e: PointerEvent, dow: number) {
  if (e.button !== 0) return
  // 子のバーの上で押されたものは onBarPointerDown が stop している
  const y = getYInColumn(e, dow)
  const anchorMin = yToMinutes(y)

  // クリック位置がいずれかの既存レンジ内ならキャンセル（バー外側のクリック判定漏れ防止）
  for (const o of othersOfDay(dow, null)) {
    if (anchorMin >= toMinutes(o.startTime) && anchorMin < toMinutes(o.endTime)) {
      return
    }
  }

  // 新しい暫定レンジを作成（最初は SNAP_MIN の長さ）
  const tempId = newTempId()
  // 新規レンジは隣接レンジと重ならないように endMin を制約
  let endMin = anchorMin + SNAP_MIN
  endMin = Math.min(endMin, minStartAbove(dow, tempId, anchorMin))
  if (endMin <= anchorMin) {
    // 空きがない場所からはドラッグ作成不可
    return
  }
  ranges.push({ tempId, dayOfWeek: dow, startTime: toTime(anchorMin), endTime: toTime(endMin) })

  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  drag.value = { kind: 'create', dayOfWeek: dow, anchorMin, tempId }
}

// ── pointermove / pointerup ─────────────────────────
function onPointerMove(e: PointerEvent) {
  const d = drag.value
  if (!d) return

  if (d.kind === 'move') {
    const r = findRange(d.tempId)
    if (!r) return
    const y = getYInColumn(e, r.dayOfWeek)
    const deltaPx = y - d.anchorY
    const deltaMin = snap(Math.round((deltaPx / HOUR_PX) * 60))
    const length = d.originEndMin - d.originStartMin

    let newStart = d.originStartMin + deltaMin
    let newEnd = newStart + length

    // 上下端で他レンジにぶつからないようにクランプ
    const lowerBound = maxEndBelow(r.dayOfWeek, r.tempId, d.originStartMin)
    const upperBound = minStartAbove(r.dayOfWeek, r.tempId, d.originEndMin)

    if (newStart < lowerBound) {
      newStart = lowerBound
      newEnd = newStart + length
    }
    if (newEnd > upperBound) {
      newEnd = upperBound
      newStart = newEnd - length
    }
    newStart = Math.max(HOUR_START * 60, newStart)
    newEnd = Math.min(HOUR_END * 60, newEnd)

    r.startTime = toTime(newStart)
    r.endTime = toTime(newEnd)
  }
  else if (d.kind === 'resize-top') {
    const r = findRange(d.tempId)
    if (!r) return
    const y = getYInColumn(e, r.dayOfWeek)
    let newStart = yToMinutes(y)
    const lowerBound = maxEndBelow(r.dayOfWeek, r.tempId, d.originEndMin)
    newStart = Math.max(lowerBound, newStart)
    newStart = Math.min(newStart, d.originEndMin - MIN_DURATION_MIN)
    r.startTime = toTime(newStart)
  }
  else if (d.kind === 'resize-bottom') {
    const r = findRange(d.tempId)
    if (!r) return
    const y = getYInColumn(e, r.dayOfWeek)
    let newEnd = yToMinutes(y)
    const upperBound = minStartAbove(r.dayOfWeek, r.tempId, d.originStartMin)
    newEnd = Math.min(upperBound, newEnd)
    newEnd = Math.max(newEnd, d.originStartMin + MIN_DURATION_MIN)
    r.endTime = toTime(newEnd)
  }
  else if (d.kind === 'create') {
    const r = findRange(d.tempId)
    if (!r) return
    const y = getYInColumn(e, d.dayOfWeek)
    const cur = yToMinutes(y)
    let s = Math.min(d.anchorMin, cur)
    let eMin = Math.max(d.anchorMin, cur)
    // 隣接レンジに食い込まないようクランプ
    s = Math.max(s, maxEndBelow(d.dayOfWeek, d.tempId, d.anchorMin))
    eMin = Math.min(eMin, minStartAbove(d.dayOfWeek, d.tempId, d.anchorMin))
    if (eMin - s < MIN_DURATION_MIN) eMin = s + MIN_DURATION_MIN
    r.startTime = toTime(s)
    r.endTime = toTime(eMin)
  }
}

function onPointerUp() {
  const d = drag.value
  if (!d) return
  if (d.kind === 'create') {
    const r = findRange(d.tempId)
    // 最低長未満のままなら破棄
    if (r && toMinutes(r.endTime) - toMinutes(r.startTime) < MIN_DURATION_MIN) {
      const idx = ranges.findIndex(x => x.tempId === d.tempId)
      if (idx >= 0) ranges.splice(idx, 1)
    }
  }
  drag.value = null
}

// ── 削除 ──────────────────────────────────────────────
function onDeleteRange(tempId: string, e: Event) {
  e.stopPropagation()
  const idx = ranges.findIndex(r => r.tempId === tempId)
  if (idx >= 0) ranges.splice(idx, 1)
}

// ── 「他の曜日にコピー」 ────────────────────────────────
function applyDayToAll(dow: number) {
  const src = rangesOfDay(dow)
  for (let other = 0; other < 7; other++) {
    if (other === dow) continue
    // 他曜日のレンジを全削除
    for (let i = ranges.length - 1; i >= 0; i--) {
      if (ranges[i]!.dayOfWeek === other) ranges.splice(i, 1)
    }
    for (const r of src) {
      ranges.push({
        tempId: newTempId(),
        dayOfWeek: other,
        startTime: r.startTime,
        endTime: r.endTime,
      })
    }
  }
}

// ── 保存 ──────────────────────────────────────────────
const formError = ref<string | null>(null)
const saving = ref(false)
const savedAt = ref<string | null>(null)

async function onSave() {
  formError.value = null

  const payload: BusinessHourRangeInput[] = ranges.map(r => ({
    dayOfWeek: r.dayOfWeek,
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
  <div
    class="space-y-4"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
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

      <div class="flex select-none">
        <!-- 時刻ラベル列 -->
        <div class="w-12 flex-shrink-0 border-r border-[#dcdcde]">
          <div class="h-7 border-b border-[#dcdcde]" />
          <div class="relative" :style="{ height: `${TOTAL_H}px` }">
            <div
              v-for="h in HOURS"
              :key="h"
              class="absolute left-0 right-0 text-[10px] text-slate-500 pr-1 text-right"
              :class="h === HOUR_START
                ? 'translate-y-0'
                : h === HOUR_END ? '-translate-y-3' : '-translate-y-1.5'"
              :style="{ top: `${(h - HOUR_START) * HOUR_PX}px` }"
            >
              {{ String(h).padStart(2, '0') }}:00
            </div>
          </div>
        </div>

        <!-- 7 曜日列 -->
        <div class="grid grid-cols-7 flex-1">
          <div
            v-for="dow in 7"
            :key="dow - 1"
            class="border-r border-[#dcdcde] last:border-r-0"
          >
            <!-- 曜日ヘッダー -->
            <div
              class="h-7 border-b border-[#dcdcde] flex items-center justify-center gap-1 text-xs font-semibold relative group"
              :class="dowHeaderColors[dow - 1]"
            >
              {{ dowLabels[dow - 1] }}
              <button
                type="button"
                class="absolute right-0.5 text-[9px] text-blue-700 hover:text-blue-900 hover:underline opacity-0 group-hover:opacity-100"
                title="この曜日を他の全曜日にコピー"
                @click="applyDayToAll(dow - 1)"
              >
                全曜日へ
              </button>
            </div>

            <!-- 時刻グリッド + 営業バー -->
            <div
              :ref="setColumnRef(dow - 1)"
              class="relative cursor-crosshair"
              :style="{ height: `${TOTAL_H}px` }"
              @pointerdown="(e) => onColumnPointerDown(e, dow - 1)"
            >
              <!-- 時刻横線（1 時間ごと） -->
              <div
                v-for="h in HOURS"
                :key="h"
                class="absolute left-0 right-0 border-t border-dashed border-[#f0f0f1] pointer-events-none"
                :style="{ top: `${(h - HOUR_START) * HOUR_PX}px` }"
              />

              <!-- 店休 -->
              <div
                v-if="rangesOfDay(dow - 1).length === 0"
                class="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 bg-[repeating-linear-gradient(45deg,_transparent,_transparent_6px,_#f6f7f7_6px,_#f6f7f7_12px)] pointer-events-none"
              >
                店休
              </div>

              <!-- 営業レンジバー -->
              <div
                v-for="r in rangesOfDay(dow - 1)"
                :key="r.tempId"
                class="absolute left-0.5 right-0.5 bg-orange-100 border border-orange-400 rounded-sm overflow-visible cursor-move shadow-sm"
                :style="{
                  top: `${minutesToTop(toMinutes(r.startTime))}px`,
                  height: `${minutesToTop(toMinutes(r.endTime)) - minutesToTop(toMinutes(r.startTime))}px`,
                }"
                @pointerdown="(e) => onBarPointerDown(e, r, 'move')"
              >
                <!-- 上端リサイズハンドル -->
                <div
                  class="absolute top-0 left-0 right-0 cursor-ns-resize bg-orange-300/40 hover:bg-orange-400/60"
                  :style="{ height: `${HANDLE_PX}px` }"
                  @pointerdown="(e) => onBarPointerDown(e, r, 'resize-top')"
                />
                <!-- 下端リサイズハンドル -->
                <div
                  class="absolute bottom-0 left-0 right-0 cursor-ns-resize bg-orange-300/40 hover:bg-orange-400/60"
                  :style="{ height: `${HANDLE_PX}px` }"
                  @pointerdown="(e) => onBarPointerDown(e, r, 'resize-bottom')"
                />
                <!-- 削除ボタン -->
                <button
                  type="button"
                  class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-orange-400 text-orange-700 hover:bg-orange-500 hover:text-white text-[10px] font-bold leading-none flex items-center justify-center shadow-sm z-10"
                  title="このレンジを削除"
                  @click="(e) => onDeleteRange(r.tempId, e)"
                  @pointerdown.stop
                >
                  ×
                </button>
                <!-- 時刻表示 -->
                <div class="text-[9px] text-orange-900 font-semibold px-1 py-0.5 leading-tight tabular-nums pointer-events-none select-none">
                  {{ r.startTime }}<br>{{ r.endTime }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
