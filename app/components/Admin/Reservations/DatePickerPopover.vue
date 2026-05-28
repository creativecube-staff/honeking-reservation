<script setup lang="ts">
// 2 ヶ月並列の日付ピッカー（ポップオーバー）
// - 月曜始まり、土=青 / 日=赤 / 祝日・店休日=赤
// - 選択中はオレンジ丸背景、今日は枠線で示す
// - 「前の月」「次の月」で 1 ヶ月ずつスライド
// - 日付クリック → emit('update:modelValue', ymd) + emit('close')
const props = withDefaults(
  defineProps<{
    modelValue: string // 'YYYY-MM-DD'
    publicHolidays?: { date: string }[]
    storeHolidays?: { date: string }[]
  }>(),
  {
    publicHolidays: () => [],
    storeHolidays: () => [],
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'close'): void
}>()

// 左に表示する月（YYYY-MM）。modelValue の月で初期化
const leftMonth = ref<string>('2026-01')
watchEffect(() => {
  const m = props.modelValue.match(/^(\d{4})-(\d{2})-\d{2}$/)
  if (m) leftMonth.value = `${m[1]}-${m[2]}`
})

function nextMonthStr(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/)
  if (!m) return ym
  let y = Number(m[1])
  let mo = Number(m[2]) + 1
  if (mo > 12) { mo = 1; y++ }
  return `${y}-${String(mo).padStart(2, '0')}`
}
const rightMonth = computed(() => nextMonthStr(leftMonth.value))

function shiftMonth(delta: number) {
  const m = leftMonth.value.match(/^(\d{4})-(\d{2})$/)
  if (!m) return
  let y = Number(m[1])
  let mo = Number(m[2]) + delta
  while (mo > 12) { mo -= 12; y++ }
  while (mo < 1) { mo += 12; y-- }
  leftMonth.value = `${y}-${String(mo).padStart(2, '0')}`
}

interface Day {
  date: number
  ymd: string
  dow: number
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  isHoliday: boolean
}

function buildMonth(ym: string): { y: number, mo: number, days: Day[] } {
  const match = ym.match(/^(\d{4})-(\d{2})$/)
  if (!match) return { y: 2026, mo: 1, days: [] }
  const y = Number(match[1])
  const mo = Number(match[2])
  const firstDay = new Date(Date.UTC(y, mo - 1, 1))
  const firstDow = firstDay.getUTCDay()
  // 月曜始まりオフセット
  const startOffset = (firstDow - 1 + 7) % 7
  const start = new Date(Date.UTC(y, mo - 1, 1 - startOffset))

  const today = todayYmd()
  const pubSet = new Set(props.publicHolidays.map(h => h.date))
  const storeSet = new Set(props.storeHolidays.map(h => h.date))

  const days: Day[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getTime() + i * 24 * 3600_000)
    const ymd = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    days.push({
      date: d.getUTCDate(),
      ymd,
      dow: d.getUTCDay(),
      isCurrentMonth: d.getUTCMonth() === mo - 1,
      isToday: ymd === today,
      isSelected: ymd === props.modelValue,
      isHoliday: pubSet.has(ymd) || storeSet.has(ymd),
    })
  }
  // 末尾 7 セルが全部翌月 → 削除（5 週で収まる月）
  while (days.length > 35 && days.slice(-7).every(d => !d.isCurrentMonth)) {
    days.splice(-7, 7)
  }
  return { y, mo, days }
}

const leftData = computed(() => buildMonth(leftMonth.value))
const rightData = computed(() => buildMonth(rightMonth.value))

const DOW_HEADERS = ['月', '火', '水', '木', '金', '土', '日']

function dowHeaderColor(i: number): string {
  if (i === 5) return 'text-blue-600' // 土
  if (i === 6) return 'text-red-600' // 日
  return 'text-slate-700'
}

function dayColorClass(d: Day): string {
  if (!d.isCurrentMonth) return 'text-slate-300'
  if (d.isHoliday || d.dow === 0) return 'text-red-600'
  if (d.dow === 6) return 'text-blue-600'
  return 'text-slate-800'
}

function onSelect(d: Day) {
  if (!d.isCurrentMonth) return
  emit('update:modelValue', d.ymd)
  emit('close')
}
</script>

<template>
  <div class="bg-white border border-[#9b9da1] rounded-sm shadow-xl overflow-hidden text-sm">
    <!-- ヘッダー（前の月 / 次の月 / 閉じる） -->
    <div class="bg-gradient-to-b from-[#e9eaec] to-[#c5c7cb] border-b border-[#9b9da1] px-3 py-2 flex items-center justify-between gap-2">
      <button
        type="button"
        class="px-3 py-1 text-xs rounded-sm bg-slate-700 hover:bg-slate-800 text-white font-semibold inline-flex items-center gap-1 shadow-sm whitespace-nowrap"
        @click="shiftMonth(-1)"
      >
        <UIcon name="i-lucide-chevron-left" class="size-3" />
        前の月
      </button>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="px-3 py-1 text-xs rounded-sm bg-slate-700 hover:bg-slate-800 text-white font-semibold inline-flex items-center gap-1 shadow-sm whitespace-nowrap"
          @click="shiftMonth(1)"
        >
          次の月
          <UIcon name="i-lucide-chevron-right" class="size-3" />
        </button>
        <button
          type="button"
          class="size-7 inline-flex items-center justify-center rounded-sm bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold border border-[#9b9da1]"
          title="閉じる"
          @click="emit('close')"
        >
          <UIcon name="i-lucide-x" class="size-4" />
        </button>
      </div>
    </div>

    <!-- 月 × 2 -->
    <div class="flex">
      <!-- 左の月 -->
      <div class="p-3 border-r border-[#dcdcde]">
        <div class="text-sm text-slate-700 mb-2 font-semibold whitespace-nowrap">
          <span class="text-base font-bold mr-1">{{ leftData.y }}</span>
          <span class="text-lg font-bold ml-1">{{ leftData.mo }}月</span>
        </div>
        <div class="grid grid-cols-[repeat(7,1.75rem)] gap-y-1 gap-x-1">
          <div
            v-for="(label, i) in DOW_HEADERS"
            :key="`l-dow-${i}`"
            class="size-7 text-xs font-semibold inline-flex items-center justify-center"
            :class="dowHeaderColor(i)"
          >
            {{ label }}
          </div>
          <template v-for="d in leftData.days" :key="`l-${d.ymd}`">
            <!-- 月外セルは枠だけのプレースホルダ（背景・hover・選択 styling 一切なし） -->
            <div v-if="!d.isCurrentMonth" class="size-7" />
            <button
              v-else
              type="button"
              class="size-7 inline-flex items-center justify-center text-xs tabular-nums rounded-full transition-colors cursor-pointer"
              :class="d.isSelected
                ? 'bg-orange-500 text-white font-bold shadow-sm'
                : [
                  dayColorClass(d),
                  'hover:bg-slate-100',
                  d.isToday && !d.isSelected ? 'ring-1 ring-orange-400' : '',
                ]"
              @click="onSelect(d)"
            >
              {{ d.date }}
            </button>
          </template>
        </div>
      </div>

      <!-- 右の月 -->
      <div class="p-3">
        <div class="text-sm text-slate-700 mb-2 font-semibold whitespace-nowrap">
          <span class="text-base font-bold mr-1">{{ rightData.y }}</span>
          <span class="text-lg font-bold ml-1">{{ rightData.mo }}月</span>
        </div>
        <div class="grid grid-cols-[repeat(7,1.75rem)] gap-y-1 gap-x-1">
          <div
            v-for="(label, i) in DOW_HEADERS"
            :key="`r-dow-${i}`"
            class="size-7 text-xs font-semibold inline-flex items-center justify-center"
            :class="dowHeaderColor(i)"
          >
            {{ label }}
          </div>
          <template v-for="d in rightData.days" :key="`r-${d.ymd}`">
            <!-- 月外セルは枠だけのプレースホルダ -->
            <div v-if="!d.isCurrentMonth" class="size-7" />
            <button
              v-else
              type="button"
              class="size-7 inline-flex items-center justify-center text-xs tabular-nums rounded-full transition-colors cursor-pointer"
              :class="d.isSelected
                ? 'bg-orange-500 text-white font-bold shadow-sm'
                : [
                  dayColorClass(d),
                  'hover:bg-slate-100',
                  d.isToday && !d.isSelected ? 'ring-1 ring-orange-400' : '',
                ]"
              @click="onSelect(d)"
            >
              {{ d.date }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
