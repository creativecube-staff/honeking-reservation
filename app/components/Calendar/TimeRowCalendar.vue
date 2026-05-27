<script setup lang="ts">
// 横軸=時刻、縦軸=任意の行（曜日・スタッフ・ベッド等）のサロンボード風カレンダー。
// 横幅は親いっぱいに伸縮（%ベース）。画面が狭いときは hourPx を 1 時間の最小幅として横スクロール。
// TimeColumnCalendar（縦軸=時刻）の横向き版。位置は % 指定、ポインタ計算は実測幅(rect.width)を使う。
import type { CalendarColumn, CalendarRange } from './types'

const props = withDefaults(
  defineProps<{
    columns: CalendarColumn[]
    ranges: CalendarRange[]
    hourStart?: number
    hourEnd?: number
    hourPx?: number // 1 時間あたりの「最小」幅（狭い画面でのスクロール下限）。通常は親幅いっぱいに伸縮する
    snapMin?: number
    minDurationMin?: number
    maxRangesPerColumn?: number | null
    allowEdit?: boolean
    emptyLabel?: string
    rowLabelWidth?: number
    rowHeight?: number
    headerPx?: number
    barCursor?: string
  }>(),
  {
    hourStart: 7,
    hourEnd: 22,
    hourPx: 48,
    snapMin: 15,
    minDurationMin: 15,
    maxRangesPerColumn: null,
    allowEdit: true,
    emptyLabel: '',
    rowLabelWidth: 56,
    rowHeight: 64,
    headerPx: 26,
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

const localRanges = ref<CalendarRange[]>([])
watchEffect(() => {
  localRanges.value = props.ranges.map(r => ({ ...r }))
})
function pushUpdate() {
  emit('update:ranges', localRanges.value.map(r => ({ ...r })))
}

// ── 時刻ヘルパー ──────────────────────────────────────
const HOURS = computed(() =>
  Array.from({ length: props.hourEnd - props.hourStart + 1 }, (_, i) => props.hourStart + i),
)
// ヘッダーの時刻ラベル。右端（hourEnd）は枠際で見づらいので表示しない。
const labelHours = computed(() => HOURS.value.slice(0, -1))
const totalMin = computed(() => (props.hourEnd - props.hourStart) * 60)
// スクロール下限となる最小トラック幅（通常は親幅いっぱいに伸縮するので、これより広くなる）
const minTrackW = computed(() => (props.hourEnd - props.hourStart) * props.hourPx)

// 目盛り（snapMin = 15 分ごと）。左端（hourStart）は行ラベルの右枠と二重になるので描かない。
const TICKS = computed(() => {
  const out: { min: number, isHour: boolean }[] = []
  for (let m = props.hourStart * 60 + props.snapMin; m <= props.hourEnd * 60; m += props.snapMin) {
    out.push({ min: m, isHour: m % 60 === 0 })
  }
  return out
})

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
// 分 → トラック幅に対する % 位置
function minutesToPct(min: number): number {
  return ((min - props.hourStart * 60) / totalMin.value) * 100
}

// ── 衝突回避ヘルパー（分単位・縦版と同一）──────────────
function rangesOfColumn(columnId: string | number): CalendarRange[] {
  return localRanges.value
    .filter(r => r.columnId === columnId)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
}
function othersInColumn(columnId: string | number, selfId: string | null): CalendarRange[] {
  return localRanges.value.filter(r => r.columnId === columnId && r.id !== selfId)
}
function maxEndBefore(columnId: string | number, selfId: string | null, value: number): number {
  let result = props.hourStart * 60
  for (const o of othersInColumn(columnId, selfId)) {
    const oe = toMinutes(o.endTime)
    if (oe <= value && oe > result) result = oe
  }
  return result
}
function minStartAfter(columnId: string | number, selfId: string | null, value: number): number {
  let result = props.hourEnd * 60
  for (const o of othersInColumn(columnId, selfId)) {
    const os = toMinutes(o.startTime)
    if (os >= value && os < result) result = os
  }
  return result
}

// ── ドラッグ state ─────────────────────────────────────
type DragState =
  | { kind: 'move', id: string, originStartMin: number, originEndMin: number, anchorX: number }
  | { kind: 'resize-left', id: string, originEndMin: number }
  | { kind: 'resize-right', id: string, originStartMin: number }
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

function getColRect(columnId: string | number): DOMRect | null {
  const col = columnRefs.get(columnId)
  return col ? col.getBoundingClientRect() : null
}
// クライアント x（トラック相対）と実測幅から分へ変換
function xToMin(x: number, width: number): number {
  if (width <= 0) return props.hourStart * 60
  return clampWindow(snap(props.hourStart * 60 + Math.round((x / width) * totalMin.value)))
}

function findRange(id: string): CalendarRange | undefined {
  return localRanges.value.find(r => r.id === id)
}

// ── バー操作 ──────────────────────────────────────────
function onBarPointerDown(e: PointerEvent, r: CalendarRange, mode: 'move' | 'resize-left' | 'resize-right') {
  if (!props.allowEdit) return
  e.stopPropagation()
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)

  const rect = getColRect(r.columnId)
  const startMin = toMinutes(r.startTime)
  const endMin = toMinutes(r.endTime)
  if (mode === 'move') {
    drag.value = {
      kind: 'move',
      id: r.id,
      originStartMin: startMin,
      originEndMin: endMin,
      anchorX: rect ? e.clientX - rect.left : 0,
    }
  }
  else if (mode === 'resize-left') {
    drag.value = { kind: 'resize-left', id: r.id, originEndMin: endMin }
  }
  else {
    drag.value = { kind: 'resize-right', id: r.id, originStartMin: startMin }
  }
}

// ── 行空白からの新規作成 ─────────────────────────────
function onColumnPointerDown(e: PointerEvent, columnId: string | number) {
  if (!props.allowEdit) return
  if (e.button !== 0) return

  if (props.maxRangesPerColumn !== null) {
    if (rangesOfColumn(columnId).length >= props.maxRangesPerColumn) return
  }

  const rect = getColRect(columnId)
  if (!rect) return
  const anchorMin = xToMin(e.clientX - rect.left, rect.width)

  for (const o of othersInColumn(columnId, null)) {
    if (anchorMin >= toMinutes(o.startTime) && anchorMin < toMinutes(o.endTime)) return
  }

  const newId = newTempId()
  let endMin = anchorMin + props.snapMin
  endMin = Math.min(endMin, minStartAfter(columnId, newId, anchorMin))
  if (endMin <= anchorMin) return

  localRanges.value.push({
    id: newId,
    columnId,
    startTime: toTime(anchorMin),
    endTime: toTime(endMin),
  })

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
    const rect = getColRect(r.columnId)
    if (!rect) return
    const x = e.clientX - rect.left
    const deltaPx = x - d.anchorX
    const deltaMin = snap(Math.round((deltaPx / rect.width) * totalMin.value))
    const length = d.originEndMin - d.originStartMin

    let newStart = d.originStartMin + deltaMin
    let newEnd = newStart + length

    const lowerBound = maxEndBefore(r.columnId, r.id, d.originStartMin)
    const upperBound = minStartAfter(r.columnId, r.id, d.originEndMin)

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
  else if (d.kind === 'resize-left') {
    const r = findRange(d.id)
    if (!r) return
    const rect = getColRect(r.columnId)
    if (!rect) return
    let newStart = xToMin(e.clientX - rect.left, rect.width)
    const lowerBound = maxEndBefore(r.columnId, r.id, d.originEndMin)
    newStart = Math.max(lowerBound, newStart)
    newStart = Math.min(newStart, d.originEndMin - props.minDurationMin)
    r.startTime = toTime(newStart)
  }
  else if (d.kind === 'resize-right') {
    const r = findRange(d.id)
    if (!r) return
    const rect = getColRect(r.columnId)
    if (!rect) return
    let newEnd = xToMin(e.clientX - rect.left, rect.width)
    const upperBound = minStartAfter(r.columnId, r.id, d.originStartMin)
    newEnd = Math.min(upperBound, newEnd)
    newEnd = Math.max(newEnd, d.originStartMin + props.minDurationMin)
    r.endTime = toTime(newEnd)
  }
  else if (d.kind === 'create') {
    const r = findRange(d.id)
    if (!r) return
    const rect = getColRect(d.columnId)
    if (!rect) return
    const cur = xToMin(e.clientX - rect.left, rect.width)
    let s = Math.min(d.anchorMin, cur)
    let eMin = Math.max(d.anchorMin, cur)
    s = Math.max(s, maxEndBefore(d.columnId, d.id, d.anchorMin))
    eMin = Math.min(eMin, minStartAfter(d.columnId, d.id, d.anchorMin))
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

function onBarClick(r: CalendarRange) {
  emit('range-click', { ...r })
}

const HANDLE_PX = 8 // 左右端のリサイズハンドル領域
</script>

<template>
  <div
    class="select-none overflow-x-auto"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <!-- 親幅いっぱいに伸縮。狭い画面では最小幅でスクロール -->
    <div :style="{ minWidth: `${rowLabelWidth + minTrackW}px` }">
      <!-- 上段: 時刻ヘッダー -->
      <div class="flex">
        <div class="flex-shrink-0 border-r border-[#dcdcde]" :style="{ width: `${rowLabelWidth}px`, height: `${headerPx}px` }" />
        <div class="relative flex-1" :style="{ height: `${headerPx}px` }">
          <div
            v-for="h in labelHours"
            :key="h"
            class="absolute top-0 bottom-0 flex items-center pl-1 text-[11px] text-slate-500"
            :style="{ left: `${minutesToPct(h * 60)}%` }"
          >
            {{ String(h).padStart(2, '0') }}:00
          </div>
        </div>
      </div>

      <!-- 行（1 行 = 1 列定義 = 曜日など） -->
      <div
        v-for="col in columns"
        :key="col.id"
        class="flex border-t border-[#dcdcde]"
      >
        <!-- 行ラベル（左） -->
        <div
          class="flex-shrink-0 border-r border-[#dcdcde] flex items-center justify-center text-xs font-semibold relative group"
          :class="[col.headerClass, col.bgClass]"
          :style="{ width: `${rowLabelWidth}px`, height: `${rowHeight}px` }"
        >
          <slot name="row-label" :column="col">
            <span>{{ col.label }}</span>
          </slot>
          <slot name="row-label-actions" :column="col" />
        </div>

        <!-- 時刻トラック + バー -->
        <div
          :ref="setColumnRef(col.id)"
          class="relative flex-1"
          :class="[col.bgClass, allowEdit && (maxRangesPerColumn === null || rangesOfColumn(col.id).length < (maxRangesPerColumn ?? 999)) ? 'cursor-crosshair' : '']"
          :style="{ height: `${rowHeight}px` }"
          @pointerdown="(e) => onColumnPointerDown(e, col.id)"
        >
          <!-- 時刻縦線（15 分ごと。正時は濃く、15 分刻みは薄い破線。左端は行ラベルの枠と兼用なので描かない） -->
          <div
            v-for="t in TICKS"
            :key="t.min"
            class="absolute top-0 bottom-0 border-l pointer-events-none"
            :class="t.isHour ? 'border-[#dcdcde]' : 'border-dashed border-[#f0f0f1]'"
            :style="{ left: `${minutesToPct(t.min)}%` }"
          />

          <!-- 空表示 -->
          <div
            v-if="emptyLabel && rangesOfColumn(col.id).length === 0"
            class="absolute inset-0 flex items-center justify-center text-[11px] text-slate-400 bg-[repeating-linear-gradient(45deg,_transparent,_transparent_6px,_#f6f7f7_6px,_#f6f7f7_12px)] pointer-events-none"
          >
            {{ emptyLabel }}
          </div>

          <!-- レンジバー（横） -->
          <div
            v-for="r in rangesOfColumn(col.id)"
            :key="r.id"
            class="absolute top-2 bottom-2 rounded-sm overflow-visible shadow-sm"
            :class="r.isGhost
              ? 'bg-slate-100/70 border border-dashed border-slate-400 hover:bg-slate-200/70'
              : 'bg-orange-100 border border-orange-400'"
            :style="{
              left: `${minutesToPct(toMinutes(r.startTime))}%`,
              width: `${minutesToPct(toMinutes(r.endTime)) - minutesToPct(toMinutes(r.startTime))}%`,
              cursor: allowEdit ? barCursor : 'default',
            }"
            @pointerdown="(e) => onBarPointerDown(e, r, 'move')"
            @click="onBarClick(r)"
          >
            <!-- 左端リサイズハンドル -->
            <div
              v-if="allowEdit"
              class="absolute left-0 top-0 bottom-0 cursor-ew-resize"
              :class="r.isGhost ? 'bg-slate-300/40 hover:bg-slate-400/60' : 'bg-orange-300/40 hover:bg-orange-400/60'"
              :style="{ width: `${HANDLE_PX}px` }"
              @pointerdown="(e) => onBarPointerDown(e, r, 'resize-left')"
            />
            <!-- 右端リサイズハンドル -->
            <div
              v-if="allowEdit"
              class="absolute right-0 top-0 bottom-0 cursor-ew-resize"
              :class="r.isGhost ? 'bg-slate-300/40 hover:bg-slate-400/60' : 'bg-orange-300/40 hover:bg-orange-400/60'"
              :style="{ width: `${HANDLE_PX}px` }"
              @pointerdown="(e) => onBarPointerDown(e, r, 'resize-right')"
            />
            <!-- 削除ボタン -->
            <button
              v-if="allowEdit && !r.isGhost"
              type="button"
              class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-orange-400 text-orange-700 hover:bg-orange-500 hover:text-white text-[10px] font-bold leading-none flex items-center justify-center shadow-sm z-10"
              title="このレンジを削除"
              @click="(e) => onDeleteRange(r.id, e)"
              @pointerdown.stop
            >
              ×
            </button>
            <!-- バー内容（選択した時間。大きめに表示） -->
            <slot name="bar" :range="r">
              <div class="text-sm text-orange-900 font-semibold px-2 h-full flex items-center tabular-nums whitespace-nowrap overflow-hidden pointer-events-none">
                {{ r.startTime }}–{{ r.endTime }}
              </div>
            </slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
