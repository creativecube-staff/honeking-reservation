<script setup lang="ts">
// 月単位のカレンダーグリッド（7 列 × 6 行 = 42 セル）。
// 各セルの中身はスロットで自由にカスタマイズできる。
//
// 親側の使い方:
//   <MonthCalendarGrid :month="'2026-05'" @cell-click="onCellClick">
//     <template #cell="{ ymd, date, isCurrentMonth, isToday, dayOfWeek }">
//       <div>{{ date }}</div>
//       <div>{{ summary[ymd] ?? '' }}</div>
//     </template>
//   </MonthCalendarGrid>

const props = withDefaults(
  defineProps<{
    month: string // "YYYY-MM"
    weekStart?: 'sunday' | 'monday'
    cellHeightPx?: number
  }>(),
  {
    weekStart: 'sunday',
    cellHeightPx: 92,
  },
)

const emit = defineEmits<{
  (e: 'cell-click', payload: { ymd: string, isCurrentMonth: boolean }): void
}>()

interface Cell {
  date: number
  ymd: string
  isCurrentMonth: boolean
  isToday: boolean
  dayOfWeek: number
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const cells = computed<Cell[]>(() => {
  const m = props.month.match(/^(\d{4})-(\d{2})$/)
  if (!m) return []
  const y = Number(m[1])
  const mo = Number(m[2])

  const firstDay = new Date(y, mo - 1, 1)
  const startOffset = (firstDay.getDay() - (props.weekStart === 'monday' ? 1 : 0) + 7) % 7
  const start = new Date(y, mo - 1, 1 - startOffset)
  const today = todayYmd()

  const result: Cell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    result.push({
      date: d.getDate(),
      ymd,
      isCurrentMonth: d.getMonth() === mo - 1,
      isToday: ymd === today,
      dayOfWeek: d.getDay(),
    })
  }
  // 最後の週が完全に翌月なら省略（5 週で済む月もある）
  while (result.length > 35 && result.slice(-7).every(c => !c.isCurrentMonth)) {
    result.splice(-7, 7)
  }
  return result
})

const dowHeaders = computed(() => {
  const labels = ['日', '月', '火', '水', '木', '金', '土']
  if (props.weekStart === 'monday') {
    return [...labels.slice(1), labels[0]!]
  }
  return labels
})

function dowColorClass(dow: number): string {
  if (dow === 0) return 'text-red-600'
  if (dow === 6) return 'text-blue-600'
  return 'text-slate-700'
}

function onCellClick(c: Cell) {
  emit('cell-click', { ymd: c.ymd, isCurrentMonth: c.isCurrentMonth })
}
</script>

<template>
  <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
    <!-- 曜日ヘッダー -->
    <div class="grid grid-cols-7 border-b border-[#c3c4c7] bg-[#f6f7f7]">
      <div
        v-for="(label, i) in dowHeaders"
        :key="i"
        class="px-2 py-1.5 text-xs font-semibold text-center"
        :class="dowColorClass(weekStart === 'monday' ? (i + 1) % 7 : i)"
      >
        {{ label }}
      </div>
    </div>

    <!-- セル -->
    <div class="grid grid-cols-7">
      <button
        v-for="(c, i) in cells"
        :key="i"
        type="button"
        class="border-r border-b border-[#dcdcde] last:border-r-0 px-1.5 py-1 text-left flex flex-col gap-0.5 hover:bg-[#fafbfc] transition-colors"
        :class="[
          !c.isCurrentMonth ? 'bg-[#f9fafb] text-slate-400' : 'bg-white',
          c.isToday ? 'ring-2 ring-orange-400 ring-inset' : '',
          (i + 1) % 7 === 0 ? 'border-r-0' : '',
        ]"
        :style="{ minHeight: `${cellHeightPx}px` }"
        @click="onCellClick(c)"
      >
        <span
          class="text-xs font-semibold tabular-nums"
          :class="[
            c.isCurrentMonth ? dowColorClass(c.dayOfWeek) : 'text-slate-400',
            c.isToday ? 'text-orange-600' : '',
          ]"
        >
          {{ c.date }}
        </span>
        <slot
          name="cell"
          :date="c.date"
          :ymd="c.ymd"
          :is-current-month="c.isCurrentMonth"
          :is-today="c.isToday"
          :day-of-week="c.dayOfWeek"
        />
      </button>
    </div>
  </div>
</template>
