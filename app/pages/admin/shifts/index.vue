<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()

// ── 日付管理 ──────────────────────────────────────────
function todayYmd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const date = computed<string>({
  get() {
    const q = String(route.query.date ?? '')
    return /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayYmd()
  },
  set(v) {
    router.replace({ query: { ...route.query, date: v } })
  },
})

function shiftDate(deltaDays: number) {
  const [y, m, d] = date.value.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  dt.setDate(dt.getDate() + deltaDays)
  const ny = dt.getFullYear()
  const nm = String(dt.getMonth() + 1).padStart(2, '0')
  const nd = String(dt.getDate()).padStart(2, '0')
  date.value = `${ny}-${nm}-${nd}`
}

const dateLabel = computed(() => {
  const [y, m, d] = date.value.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  const dow = ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()]
  return `${y}年${m}月${d}日 (${dow})`
})

// ── その日の各店舗の営業状況（情報表示用）────────────
type ScheduleByDate = {
  store: { id: number, name: string, slug: string }
  date: string
  dayOfWeek: number
  isHoliday: boolean
  holidayNote: string | null
  isPublicHoliday: boolean
  publicHolidayName: string | null
  isClosed: boolean
  openTime: string | null
  closeTime: string | null
  breakStartTime: string | null
  breakEndTime: string | null
}

const { data: schedule } = await useFetch<ScheduleByDate[]>('/api/admin/schedule/by-date', {
  query: { date },
  watch: [date],
})

const publicHolidayName = computed(() => {
  return (schedule.value ?? []).find(s => s.isPublicHoliday)?.publicHolidayName ?? null
})
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        シフト管理
      </h1>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      Google カレンダー風 UI で、空白部分をドラッグして出勤時間を入力できます。
    </p>

    <!-- 日付ナビゲーション -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm p-3 mb-4 flex items-center gap-3 flex-wrap">
      <button
        type="button"
        class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
        @click="shiftDate(-1)"
      >
        ← 前日
      </button>
      <input
        v-model="date"
        type="date"
        class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500"
      >
      <span class="text-sm font-semibold text-slate-900">{{ dateLabel }}</span>
      <button
        type="button"
        class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
        @click="shiftDate(1)"
      >
        翌日 →
      </button>
      <button
        type="button"
        class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm ml-2"
        @click="date = todayYmd()"
      >
        今日
      </button>
    </div>

    <!-- その日の各店舗の営業状況 -->
    <div v-if="(schedule ?? []).length > 0" class="bg-white border border-[#c3c4c7] rounded-sm p-3 mb-4">
      <h3 class="text-xs font-semibold text-slate-900 mb-2 flex items-center gap-2">
        <UIcon name="i-lucide-clock" class="size-4" />
        この日の営業状況
        <span v-if="publicHolidayName" class="text-orange-700">
          祝日: {{ publicHolidayName }}（日曜扱い）
        </span>
      </h3>
      <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div v-for="s in schedule" :key="s.store.id" class="flex items-center gap-2">
          <span class="font-medium text-slate-900">{{ s.store.name }}:</span>
          <span v-if="s.isHoliday" class="text-red-700 font-medium">
            🚫 店休日<span v-if="s.holidayNote" class="text-xs text-slate-500"> ({{ s.holidayNote }})</span>
          </span>
          <span v-else-if="s.isClosed" class="text-slate-500">
            定休
          </span>
          <span v-else-if="s.openTime && s.closeTime" class="text-slate-700">
            {{ s.openTime }}–{{ s.closeTime }}
            <span v-if="s.breakStartTime && s.breakEndTime" class="text-xs text-slate-500">
              （休憩 {{ s.breakStartTime }}–{{ s.breakEndTime }}）
            </span>
          </span>
          <span v-else class="text-slate-500 text-xs">
            営業時間未設定
          </span>
        </div>
      </div>
    </div>

    <!-- 日ビュー（D&D カレンダー）-->
    <ShiftDayCalendar :date="date" />
  </div>
</template>
