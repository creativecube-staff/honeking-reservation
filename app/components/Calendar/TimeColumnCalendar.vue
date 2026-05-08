<script setup lang="ts">
// 縦軸=時刻、横軸=任意の列（曜日・スタッフ・ベッド等）の Google Calendar 風カレンダー。
// 列内に時間レンジ（バー）を D&D で配置・移動・リサイズ・削除できる。
//
// 親側の使い方:
//   <TimeColumnCalendar
//     v-model:ranges="ranges"
//     :columns="columns"
//     :max-ranges-per-column="1"
//   >
//     <template #bar="{ range }">...</template>
//     <template #column-footer="{ column }">...</template>
//   </TimeColumnCalendar>
//
// Range.id は文字列。親が新規作成を判定したい場合は "temp-XX" と "DB-id" で識別する。

import type { CalendarColumn, CalendarRange } from './types'

const props = withDefaults(
  defineProps<{
    columns: CalendarColumn[]
    ranges: CalendarRange[]
    hourStart?: number
    hourEnd?: number
    hourPx?: number
    snapMin?: number
    minDurationMin?: number
    /** 1 列あたりの最大レンジ数。null = 無制限。1 を指定すると「1 列 1 レンジ」運用（シフト等） */
    maxRangesPerColumn?: number | null
    allowEdit?: boolean
    /** 列にレンジが 0 件のときに中央に薄く表示するテキスト */
    emptyLabel?: string
    /** カラムヘッダーの高さ */
    headerPx?: number
    /** バー本体の cursor スタイル（'move' or 'pointer' など） */
    barCursor?: string
  }>(),
  {
    hourStart: 7,
    hourEnd: 22,
    hourPx: 36,
    snapMin: 15,
    minDurationMin: 15,
    maxRangesPerColumn: null,
    allowEdit: true,
    emptyLabel: '',
    headerPx: 28,
    barCursor: 'move',
  },
)

const emit = defineEmits<{
  (e: 'update:ranges', ranges: CalendarRange[]): void
  (e: 'range-create', range: CalendarRange): void
  (e: 'range-update', range: CalendarRange): void
  (e: 'range-delete', id: string): void
  (e: 'range-click', range: CalendarRange): void
}>()

// 親から渡された ranges を内部 state にコピー。操作後に emit で親へ通知する。
// 配列の破壊的変更（push / splice / プロパティ書き換え）を defineModel に頼らず、
// 明示的に emit('update:ranges', ...) するため。
const localRanges = ref<CalendarRange[]>([])

watchEffect(() => {
  // 親側 props.ranges が変わるたびに完全コピー（参照を分離）
  localRanges.value = props.ranges.map(r => ({ ...r }))
})

function pushUpdate() {
  emit('update:ranges', localRanges.value.map(r => ({ ...r })))
}

// ── 時刻ヘルパー ──────────────────────────────────────
const HOURS = computed(() =>
  Array.from({ length: props.hourEnd - props.hourStart + 1 }, (_, i) => props.hourStart + i),
)
const TOTAL_H = computed(() => (props.hourEnd - props.hourStart) * props.hourPx)

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
  return Math.round(min / props.snapMin) * props.snapMin
}
function clampWindow(min: number): number {
  return Math.max(props.hourStart * 60, Math.min(props.hourEnd * 60, min))
}
function yToMinutes(y: number): number {
  return clampWindow(snap(props.hourStart * 60 + Math.round((y / props.hourPx) * 60)))
}
function minutesToTop(min: number): number {
  return ((min - props.hourStart * 60) * props.hourPx) / 60
}

// ── 衝突回避ヘルパー ────────────────────────────────────
function rangesOfColumn(columnId: string | number): CalendarRange[] {
  return localRanges.value
    .filter(r => r.columnId === columnId)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
}
function othersInColumn(columnId: string | number, selfId: string | null): CalendarRange[] {
  return localRanges.value.filter(r => r.columnId === columnId && r.id !== selfId)
}
function maxEndBelow(columnId: string | number, selfId: string | null, value: number): number {
  let result = props.hourStart * 60
  for (const o of othersInColumn(columnId, selfId)) {
    const oe = toMinutes(o.endTime)
    if (oe <= value && oe > result) result = oe
  }
  return result
}
function minStartAbove(columnId: string | number, selfId: string | null, value: number): number {
  let result = props.hourEnd * 60
  for (const o of othersInColumn(columnId, selfId)) {
    const os = toMinutes(o.startTime)
    if (os >= value && os < result) result = os
  }
  return result
}

// ── ドラッグ state ─────────────────────────────────────
type DragState =
  | { kind: 'move', id: string, originStartMin: number, originEndMin: number, anchorY: number }
  | { kind: 'resize-top', id: string, originEndMin: number }
  | { kind: 'resize-bottom', id: string, originStartMin: number }
  | { kind: 'create', columnId: string | number, anchorMin: number, id: string }

const drag = ref<DragState | null>(null)
const columnRefs = new Map<string | number, HTMLElement>()
let tempCounter = 0
function newTempId(): string {
  tempCounter += 1
  return `temp-${Date.now()}-${tempCounter}`
}

function setColumnRef(columnId: string | number) {
  return (el: Element | { $el: Element } | null) => {
    if (!el) {
      columnRefs.delete(columnId)
      return
    }
    const node = (el as { $el?: Element }).$el ?? el
    columnRefs.set(columnId, node as HTMLElement)
  }
}

function getYInColumn(e: PointerEvent, columnId: string | number): number {
  const col = columnRefs.get(columnId)
  if (!col) return 0
  const rect = col.getBoundingClientRect()
  return e.clientY - rect.top
}

function findRange(id: string): CalendarRange | undefined {
  return localRanges.value.find(r => r.id === id)
}

// ── バー操作 ──────────────────────────────────────────
function onBarPointerDown(e: PointerEvent, r: CalendarRange, mode: 'move' | 'resize-top' | 'resize-bottom') {
  if (!props.allowEdit) return
  e.stopPropagation()
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)

  const startMin = toMinutes(r.startTime)
  const endMin = toMinutes(r.endTime)
  if (mode === 'move') {
    drag.value = {
      kind: 'move',
      id: r.id,
      originStartMin: startMin,
      originEndMin: endMin,
      anchorY: getYInColumn(e, r.columnId),
    }
  }
  else if (mode === 'resize-top') {
    drag.value = { kind: 'resize-top', id: r.id, originEndMin: endMin }
  }
  else {
    drag.value = { kind: 'resize-bottom', id: r.id, originStartMin: startMin }
  }
}

// ── 列空白からの新規作成 ─────────────────────────────
function onColumnPointerDown(e: PointerEvent, columnId: string | number) {
  if (!props.allowEdit) return
  if (e.button !== 0) return

  // 1 列あたりの最大レンジ数を超えていれば作成不可
  if (props.maxRangesPerColumn !== null) {
    const count = rangesOfColumn(columnId).length
    if (count >= props.maxRangesPerColumn) return
  }

  const y = getYInColumn(e, columnId)
  const anchorMin = yToMinutes(y)

  // クリック位置が既存レンジ内ならキャンセル
  for (const o of othersInColumn(columnId, null)) {
    if (anchorMin >= toMinutes(o.startTime) && anchorMin < toMinutes(o.endTime)) {
      return
    }
  }

  const newId = newTempId()
  let endMin = anchorMin + props.snapMin
  endMin = Math.min(endMin, minStartAbove(columnId, newId, anchorMin))
  if (endMin <= anchorMin) return

  const newRange: CalendarRange = {
    id: newId,
    columnId,
    startTime: toTime(anchorMin),
    endTime: toTime(endMin),
  }
  localRanges.value.push(newRange)

  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  drag.value = { kind: 'create', columnId, anchorMin, id: newId }
}

// ── pointermove / pointerup ─────────────────────────
function onPointerMove(e: PointerEvent) {
  const d = drag.value
  if (!d) return

  if (d.kind === 'move') {
    const r = findRange(d.id)
    if (!r) return
    const y = getYInColumn(e, r.columnId)
    const deltaPx = y - d.anchorY
    const deltaMin = snap(Math.round((deltaPx / props.hourPx) * 60))
    const length = d.originEndMin - d.originStartMin

    let newStart = d.originStartMin + deltaMin
    let newEnd = newStart + length

    const lowerBound = maxEndBelow(r.columnId, r.id, d.originStartMin)
    const upperBound = minStartAbove(r.columnId, r.id, d.originEndMin)

    if (newStart < lowerBound) {
      newStart = lowerBound
      newEnd = newStart + length
    }
    if (newEnd > upperBound) {
      newEnd = upperBound
      newStart = newEnd - length
    }
    newStart = Math.max(props.hourStart * 60, newStart)
    newEnd = Math.min(props.hourEnd * 60, newEnd)

    r.startTime = toTime(newStart)
    r.endTime = toTime(newEnd)
  }
  else if (d.kind === 'resize-top') {
    const r = findRange(d.id)
    if (!r) return
    const y = getYInColumn(e, r.columnId)
    let newStart = yToMinutes(y)
    const lowerBound = maxEndBelow(r.columnId, r.id, d.originEndMin)
    newStart = Math.max(lowerBound, newStart)
    newStart = Math.min(newStart, d.originEndMin - props.minDurationMin)
    r.startTime = toTime(newStart)
  }
  else if (d.kind === 'resize-bottom') {
    const r = findRange(d.id)
    if (!r) return
    const y = getYInColumn(e, r.columnId)
    let newEnd = yToMinutes(y)
    const upperBound = minStartAbove(r.columnId, r.id, d.originStartMin)
    newEnd = Math.min(upperBound, newEnd)
    newEnd = Math.max(newEnd, d.originStartMin + props.minDurationMin)
    r.endTime = toTime(newEnd)
  }
  else if (d.kind === 'create') {
    const r = findRange(d.id)
    if (!r) return
    const y = getYInColumn(e, d.columnId)
    const cur = yToMinutes(y)
    let s = Math.min(d.anchorMin, cur)
    let eMin = Math.max(d.anchorMin, cur)
    s = Math.max(s, maxEndBelow(d.columnId, d.id, d.anchorMin))
    eMin = Math.min(eMin, minStartAbove(d.columnId, d.id, d.anchorMin))
    if (eMin - s < props.minDurationMin) eMin = s + props.minDurationMin
    r.startTime = toTime(s)
    r.endTime = toTime(eMin)
  }
}

function onPointerUp() {
  const d = drag.value
  if (!d) return

  if (d.kind === 'create') {
    const r = findRange(d.id)
    // 最低長未満のままなら破棄
    if (r && toMinutes(r.endTime) - toMinutes(r.startTime) < props.minDurationMin) {
      const idx = localRanges.value.findIndex(x => x.id === d.id)
      if (idx >= 0) localRanges.value.splice(idx, 1)
    }
    else if (r) {
      pushUpdate()
      emit('range-create', { ...r })
    }
  }
  else {
    const r = findRange(d.id)
    if (r) {
      pushUpdate()
      emit('range-update', { ...r })
    }
  }
  drag.value = null
}

// ── 削除 ──────────────────────────────────────────────
function onDeleteRange(id: string, e: Event) {
  if (!props.allowEdit) return
  e.stopPropagation()
  const idx = localRanges.value.findIndex(r => r.id === id)
  if (idx >= 0) {
    localRanges.value.splice(idx, 1)
    pushUpdate()
    emit('range-delete', id)
  }
}

// ── バー単独クリック（D&D ではなくクリック）──────────
function onBarClick(r: CalendarRange) {
  emit('range-click', { ...r })
}

const HANDLE_PX = 8 // 上下端のリサイズハンドル領域
</script>

<template>
  <div
    class="select-none"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div class="flex">
      <!-- 時刻ラベル列 -->
      <div class="w-12 flex-shrink-0 border-r border-[#dcdcde]">
        <div class="border-b border-[#dcdcde]" :style="{ height: `${headerPx}px` }" />
        <div class="relative" :style="{ height: `${TOTAL_H}px` }">
          <div
            v-for="h in HOURS"
            :key="h"
            class="absolute left-0 right-0 text-[10px] text-slate-500 pr-1 text-right"
            :class="h === hourStart
              ? 'translate-y-0'
              : h === hourEnd ? '-translate-y-3' : '-translate-y-1.5'"
            :style="{ top: `${(h - hourStart) * hourPx}px` }"
          >
            {{ String(h).padStart(2, '0') }}:00
          </div>
        </div>
      </div>

      <!-- 列 -->
      <div class="flex flex-1">
        <div
          v-for="col in columns"
          :key="col.id"
          class="flex-1 min-w-0 border-r border-[#dcdcde] last:border-r-0"
        >
          <!-- 列ヘッダー -->
          <div
            class="border-b border-[#dcdcde] flex flex-col items-center justify-center text-xs font-semibold relative group"
            :class="col.headerClass"
            :style="{ height: `${headerPx}px` }"
          >
            <slot name="column-header" :column="col">
              <span>{{ col.label }}</span>
              <span v-if="col.subLabel" class="text-[10px] font-normal text-slate-500">
                {{ col.subLabel }}
              </span>
            </slot>
            <slot name="column-header-actions" :column="col" />
          </div>

          <!-- 時刻グリッド + バー -->
          <div
            :ref="setColumnRef(col.id)"
            class="relative"
            :class="allowEdit && (maxRangesPerColumn === null || rangesOfColumn(col.id).length < (maxRangesPerColumn ?? 999)) ? 'cursor-crosshair' : ''"
            :style="{ height: `${TOTAL_H}px` }"
            @pointerdown="(e) => onColumnPointerDown(e, col.id)"
          >
            <!-- 時刻横線 -->
            <div
              v-for="h in HOURS"
              :key="h"
              class="absolute left-0 right-0 border-t border-dashed border-[#f0f0f1] pointer-events-none"
              :style="{ top: `${(h - hourStart) * hourPx}px` }"
            />

            <!-- 空表示 -->
            <div
              v-if="emptyLabel && rangesOfColumn(col.id).length === 0"
              class="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 bg-[repeating-linear-gradient(45deg,_transparent,_transparent_6px,_#f6f7f7_6px,_#f6f7f7_12px)] pointer-events-none"
            >
              {{ emptyLabel }}
            </div>

            <!-- レンジバー -->
            <div
              v-for="r in rangesOfColumn(col.id)"
              :key="r.id"
              class="absolute left-0.5 right-0.5 rounded-sm overflow-visible shadow-sm"
              :class="['bg-orange-100 border border-orange-400']"
              :style="{
                top: `${minutesToTop(toMinutes(r.startTime))}px`,
                height: `${minutesToTop(toMinutes(r.endTime)) - minutesToTop(toMinutes(r.startTime))}px`,
                cursor: allowEdit ? barCursor : 'default',
              }"
              @pointerdown="(e) => onBarPointerDown(e, r, 'move')"
              @click="onBarClick(r)"
            >
              <!-- 上端リサイズハンドル -->
              <div
                v-if="allowEdit"
                class="absolute top-0 left-0 right-0 cursor-ns-resize bg-orange-300/40 hover:bg-orange-400/60"
                :style="{ height: `${HANDLE_PX}px` }"
                @pointerdown="(e) => onBarPointerDown(e, r, 'resize-top')"
              />
              <!-- 下端リサイズハンドル -->
              <div
                v-if="allowEdit"
                class="absolute bottom-0 left-0 right-0 cursor-ns-resize bg-orange-300/40 hover:bg-orange-400/60"
                :style="{ height: `${HANDLE_PX}px` }"
                @pointerdown="(e) => onBarPointerDown(e, r, 'resize-bottom')"
              />
              <!-- 削除ボタン -->
              <button
                v-if="allowEdit"
                type="button"
                class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-orange-400 text-orange-700 hover:bg-orange-500 hover:text-white text-[10px] font-bold leading-none flex items-center justify-center shadow-sm z-10"
                title="このレンジを削除"
                @click="(e) => onDeleteRange(r.id, e)"
                @pointerdown.stop
              >
                ×
              </button>
              <!-- バー内容 -->
              <slot name="bar" :range="r">
                <div class="text-[9px] text-orange-900 font-semibold px-1 py-0.5 leading-tight tabular-nums pointer-events-none">
                  {{ r.startTime }}<br>{{ r.endTime }}
                </div>
              </slot>
            </div>

            <!-- 列フッター（slot） -->
            <slot name="column-footer" :column="col" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
