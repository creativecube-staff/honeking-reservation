<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function todayYmd() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function todayYm() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

// ── ビュー切替 ──────────────────────────────────────
type View = 'month' | 'day'
const view = computed<View>({
  get() {
    return route.query.view === 'month' ? 'month' : 'day'
  },
  set(v) {
    router.replace({ query: { ...route.query, view: v } })
  },
})

// ── 日付（日ビュー用）─────────────────────────────────
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
  date.value = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

const dateLabel = computed(() => {
  const [y, m, d] = date.value.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  const dow = ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()]
  return `${y}年${m}月${d}日 (${dow})`
})

// ── 月（月ビュー用）────────────────────────────────────
const month = computed<string>({
  get() {
    const q = String(route.query.month ?? '')
    if (/^\d{4}-\d{2}$/.test(q)) return q
    // date があれば date から派生
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(route.query.date ?? ''))) {
      return String(route.query.date).slice(0, 7)
    }
    return todayYm()
  },
  set(v) {
    router.replace({ query: { ...route.query, month: v } })
  },
})

function shiftMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number)
  const dt = new Date(y!, m! - 1 + delta, 1)
  month.value = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`
}

const monthLabel = computed(() => {
  const [y, m] = month.value.split('-').map(Number)
  return `${y}年${m}月`
})

// ── 日ビュー用：その日の各店舗の営業状況 ─────────────
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
    <div class="flex items-center gap-3 mb-1 flex-wrap">
      <h1 class="text-2xl font-semibold text-slate-900">
        シフト管理
      </h1>
      <!-- 月/日ビュー切替 -->
      <div class="inline-flex border border-[#8c8f94] rounded-sm overflow-hidden text-sm">
        <button
          type="button"
          class="px-3 py-1"
          :class="view === 'month' ? 'bg-orange-500 text-white' : 'bg-white text-slate-700 hover:bg-[#f6f7f7]'"
          @click="view = 'month'"
        >
          月ビュー
        </button>
        <button
          type="button"
          class="px-3 py-1 border-l border-[#8c8f94]"
          :class="view === 'day' ? 'bg-orange-500 text-white' : 'bg-white text-slate-700 hover:bg-[#f6f7f7]'"
          @click="view = 'day'"
        >
          日ビュー
        </button>
      </div>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      <template v-if="view === 'day'">
        Google カレンダー風 UI で、空白部分をドラッグして出勤時間を入力できます。
      </template>
      <template v-else>
        月単位で出勤状況を俯瞰します。日付をクリックすると日ビューに切り替わります。
      </template>
    </p>

    <!-- 月ビュー -->
    <template v-if="view === 'month'">
      <!-- 月ナビゲーション -->
      <div class="bg-white border border-[#c3c4c7] rounded-sm p-3 mb-4 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
          @click="shiftMonth(-1)"
        >
          ← 前月
        </button>
        <input
          v-model="month"
          type="month"
          class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500"
        >
        <span class="text-sm font-semibold text-slate-900">{{ monthLabel }}</span>
        <button
          type="button"
          class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
          @click="shiftMonth(1)"
        >
          翌月 →
        </button>
        <button
          type="button"
          class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm ml-2"
          @click="month = todayYm()"
        >
          今月
        </button>
      </div>

      <AdminShiftsShiftMonthCalendar :month="month" />
    </template>

    <!-- 日ビュー -->
    <template v-else>
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

      <AdminShiftsShiftDayCalendar :date="date" />
    </template>
  </div>
</template>
