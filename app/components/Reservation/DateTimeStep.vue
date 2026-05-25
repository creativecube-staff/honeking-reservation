<script setup lang="ts">
// 予約フロー(SPA) ステップ 2/3: 日時選択(時刻×曜日グリッド)
import { MAX_ADVANCE_DAYS } from '~~/shared/reservationPolicy'
type Store = {
  id: number
  slug: string
  prefecture: string
  city: string
  name: string
  address: string
  phone: string | null
}
type Menu = {
  id: number
  storeId: number | null
  name: string
  description: string | null
  durationMinutes: number
  priceJpy: number
}
type SlotInfo = { time: string, capacity: number }
type DayAvail = {
  date: string
  isClosed: boolean
  isHoliday: boolean
  isPublicHoliday: boolean
  publicHolidayName: string | null
  slots: SlotInfo[]
  openTime: string | null
  closeTime: string | null
}

interface Props {
  store: Store
  menu: Menu
}
const props = defineProps<Props>()

const emit = defineEmits<{
  select: [startAt: string]
  back: []
}>()

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  dt.setDate(dt.getDate() + n)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

const WEEK_DAYS = 7
// SPA 化に伴い URL クエリではなくローカル ref で週オフセットを管理
const offsetYmd = ref<string>(todayYmd())

const rangeFrom = computed(() => offsetYmd.value)
const rangeTo = computed(() => addDays(offsetYmd.value, WEEK_DAYS - 1))

// 予約可能な最終日(今日 + MAX_ADVANCE_DAYS - 1)。
// 「次の週 →」を押したとき rangeFrom が maxRangeFrom を超えないように制限する。
const maxLastYmd = computed(() => addDays(todayYmd(), MAX_ADVANCE_DAYS - 1))
const maxRangeFrom = computed(() => addDays(maxLastYmd.value, -(WEEK_DAYS - 1)))
const canGoNext = computed(() => rangeFrom.value < maxRangeFrom.value)

const { data: availability, status, error: availError } = await useFetch<DayAvail[]>('/api/availability', {
  query: computed(() => ({
    slug: props.store.slug,
    menuId: props.menu.id,
    from: rangeFrom.value,
    to: rangeTo.value,
  })),
  watch: [rangeFrom, rangeTo, () => props.menu.id],
})

function parseHm(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}
function formatHm(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

const timeRows = computed<string[]>(() => {
  let earliest = Infinity
  let latest = -Infinity
  for (const day of availability.value ?? []) {
    if (day.openTime) earliest = Math.min(earliest, parseHm(day.openTime))
    if (day.closeTime) latest = Math.max(latest, parseHm(day.closeTime))
  }
  if (!Number.isFinite(earliest) || !Number.isFinite(latest)) return []
  const duration = props.menu.durationMinutes
  const result: string[] = []
  for (let t = earliest; t + duration <= latest; t += 30) {
    result.push(formatHm(t))
  }
  return result
})

const now = ref(new Date())
let nowTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  nowTimer = setInterval(() => { now.value = new Date() }, 60_000)
})
onUnmounted(() => { if (nowTimer) clearInterval(nowTimer) })

function nowYmdLocal(): string {
  const d = now.value
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function nowMin(): number {
  return now.value.getHours() * 60 + now.value.getMinutes()
}
function slotMin(time: string): number {
  return parseHm(time)
}

type Status = 'open' | 'last' | 'fullyBooked' | 'closed' | 'past' | 'outOfHours'
function statusFor(day: DayAvail | undefined, time: string): Status {
  if (!day) return 'outOfHours'
  if (day.isHoliday || day.isClosed) return 'closed'
  const t = nowYmdLocal()
  if (day.date === t && slotMin(time) <= nowMin()) return 'past'
  if (day.date < t) return 'past'
  const slot = day.slots.find(s => s.time === time)
  if (!slot) return 'outOfHours'
  if (slot.capacity >= 2) return 'open'
  if (slot.capacity === 1) return 'last'
  return 'fullyBooked'
}

function dayHeader(ymd: string): { date: number, dow: string, dowColor: string, isToday: boolean } {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  const dow = dt.getDay()
  const dowLabel = ['日', '月', '火', '水', '木', '金', '土'][dow]!
  let dowColor = 'text-slate-700'
  if (dow === 0) dowColor = 'text-red-600'
  else if (dow === 6) dowColor = 'text-blue-600'
  return {
    date: d!,
    dow: dowLabel,
    dowColor,
    isToday: ymd === todayYmd(),
  }
}

function shiftRange(deltaDays: number) {
  offsetYmd.value = addDays(offsetYmd.value, deltaDays)
}

function resetToThisWeek() {
  offsetYmd.value = todayYmd()
}

// startAt 形式: "YYYY-MM-DDTHHMM"(URL に : を含めないため 4 桁時刻)
function onSelectSlot(ymd: string, time: string) {
  const startAt = `${ymd}T${time.replace(':', '')}`
  emit('select', startAt)
}

function duration(min: number): string {
  if (min < 60) return `${min} 分`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} 時間` : `${h} 時間 ${m} 分`
}

function yen(n: number): string {
  return n.toLocaleString('ja-JP')
}

function dayClosedReason(day: DayAvail): string | null {
  if (day.isHoliday) return '店休'
  if (day.isClosed) return '定休'
  return null
}
</script>

<template>
  <div>
    <!-- 中央寄せ見出し(MenuStep と同パターン)を上に -->
    <div class="text-center mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
        ご希望の<span class="text-orange-600">日時</span>を<br class="sm:hidden">選んでください
      </h1>
      <p class="mt-3 inline-flex items-center gap-1.5 text-xs sm:text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-full px-3.5 py-1.5">
        <UIcon name="i-lucide-mouse-pointer-click" class="shrink-0 w-3.5 h-3.5 text-orange-600" />
        空き枠(◯)をタップして次のステップへ
      </p>
      <div class="mt-4 flex justify-center">
        <UIcon name="i-lucide-chevron-down" class="w-6 h-6 text-orange-500 animate-bounce" />
      </div>
    </div>

    <!-- 予約中の店舗ストリップ -->
    <div class="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 mb-3">
      <div class="flex items-center gap-2 min-w-0">
        <UIcon name="i-lucide-store" class="size-4 sm:size-5 text-orange-600 shrink-0" />
        <div class="min-w-0">
          <p class="text-[10px] sm:text-xs text-slate-500 leading-tight">ご予約中の店舗</p>
          <p class="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">{{ store.name }}</p>
        </div>
      </div>
      <div class="shrink-0 text-right">
        <p class="text-xs sm:text-sm text-slate-700 leading-tight">{{ store.prefecture }}{{ store.city }}</p>
      </div>
    </div>

    <!-- 選択中のメニュー(コンパクトストリップ) -->
    <div class="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 mb-6">
      <div class="flex items-center gap-2 min-w-0">
        <UIcon name="i-lucide-list" class="size-4 sm:size-5 text-orange-600 shrink-0" />
        <div class="min-w-0">
          <p class="text-[10px] sm:text-xs text-slate-500 leading-tight">選択中のメニュー</p>
          <p class="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">{{ menu.name }}</p>
        </div>
      </div>
      <div class="shrink-0 text-right">
        <p class="text-base sm:text-lg font-extrabold text-orange-600 tabular-nums leading-none">
          ¥{{ yen(menu.priceJpy) }}
        </p>
        <p class="text-[10px] sm:text-xs text-slate-500 mt-0.5">{{ duration(menu.durationMinutes) }}</p>
      </div>
    </div>

    <div class="flex items-center justify-between mb-3 gap-2 flex-wrap">
      <button
        type="button"
        class="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
        :disabled="rangeFrom <= todayYmd()"
        @click="shiftRange(-WEEK_DAYS)"
      >
        ← 前の週
      </button>
      <span class="text-sm text-slate-700 tabular-nums font-semibold">
        {{ rangeFrom.replace(/-/g, '/') }} – {{ rangeTo.replace(/-/g, '/') }}
      </span>
      <div class="flex gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          :disabled="rangeFrom === todayYmd()"
          @click="resetToThisWeek"
        >
          今週
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          :disabled="!canGoNext"
          @click="shiftRange(WEEK_DAYS)"
        >
          次の週 →
        </button>
      </div>
    </div>

    <p
      v-if="!canGoNext"
      class="-mt-1 mb-3 text-xs text-slate-500 inline-flex items-center gap-1"
    >
      <UIcon name="i-lucide-info" class="size-3.5 text-slate-400" />
      ご予約は本日から {{ MAX_ADVANCE_DAYS }} 日先までお受けしております
    </p>

    <UAlert
      v-if="availError"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`空き状況の取得に失敗しました: ${availError.message}`"
    />

    <div v-else-if="status === 'pending'" class="text-slate-600 py-10 text-center">
      読み込み中...
    </div>

    <div v-else-if="(availability ?? []).length === 0" class="text-slate-500 text-sm py-10 text-center">
      空き状況を取得できませんでした。
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-slate-300 bg-white shadow-sm">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="bg-slate-50">
            <th class="sticky left-0 z-10 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-600 border-b border-r border-slate-300 w-16">
              時刻
            </th>
            <th
              v-for="day in (availability ?? [])"
              :key="day.date"
              class="px-1 py-2 text-center border-b border-r border-slate-300 last:border-r-0 min-w-[64px]"
              :class="dayHeader(day.date).isToday ? 'bg-orange-200 ring-2 ring-orange-500 ring-inset' : ''"
            >
              <div class="text-[11px] font-semibold" :class="dayHeader(day.date).dowColor">
                {{ dayHeader(day.date).dow }}
                <span v-if="day.isPublicHoliday" class="ml-0.5 text-[9px] text-red-700">祝</span>
              </div>
              <div class="text-lg font-extrabold tabular-nums" :class="dayHeader(day.date).dowColor">
                {{ dayHeader(day.date).date }}
              </div>
              <div v-if="dayHeader(day.date).isToday" class="text-[10px] font-bold text-orange-800 mt-0.5">
                今日
              </div>
            </th>
          </tr>
          <tr v-if="(availability ?? []).some(d => dayClosedReason(d))" class="bg-slate-50">
            <th class="sticky left-0 z-10 bg-slate-50 px-2 py-1 text-[10px] font-normal text-slate-500 border-b border-r border-slate-300">
              状況
            </th>
            <td
              v-for="day in (availability ?? [])"
              :key="day.date"
              class="px-1 py-1 text-center text-[10px] border-b border-r border-slate-300 last:border-r-0"
              :class="dayClosedReason(day) ? 'bg-red-50 text-red-700 font-semibold' : 'text-slate-400'"
            >
              {{ dayClosedReason(day) ?? '営業' }}
            </td>
          </tr>
        </thead>
        <tbody>
          <tr v-if="timeRows.length === 0">
            <td :colspan="(availability ?? []).length + 1" class="px-3 py-8 text-center text-slate-500 text-sm">
              この週は予約可能な時間がありません。「次の週 →」をお試しください。
            </td>
          </tr>
          <tr v-for="time in timeRows" :key="time" class="hover:bg-slate-50/50">
            <th class="sticky left-0 z-10 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 border-b border-r border-slate-200 tabular-nums">
              {{ time }}
            </th>
            <td
              v-for="day in (availability ?? [])"
              :key="day.date"
              class="px-0.5 py-0 text-center border-b border-r border-slate-200 last:border-r-0"
              :class="[
                dayHeader(day.date).isToday ? 'bg-orange-50/60' : '',
                statusFor(day, time) === 'closed' ? 'bg-slate-100' : '',
                statusFor(day, time) === 'past' ? 'bg-slate-50' : '',
                statusFor(day, time) === 'fullyBooked' ? 'bg-amber-50' : '',
              ]"
            >
              <template v-if="statusFor(day, time) === 'open'">
                <button
                  type="button"
                  class="w-full py-2 text-lg font-extrabold text-red-600 hover:bg-red-100 active:bg-red-200 rounded transition cursor-pointer"
                  :title="`${day.date} ${time} を予約する`"
                  @click="onSelectSlot(day.date, time)"
                >
                  ◯
                </button>
              </template>
              <template v-else-if="statusFor(day, time) === 'last'">
                <button
                  type="button"
                  class="w-full py-2 text-lg font-extrabold text-orange-600 hover:bg-orange-100 active:bg-orange-200 rounded transition cursor-pointer"
                  :title="`${day.date} ${time} を予約する(残り1枠)`"
                  @click="onSelectSlot(day.date, time)"
                >
                  △
                </button>
              </template>
              <template v-else-if="statusFor(day, time) === 'fullyBooked'">
                <a
                  v-if="store.phone"
                  :href="`tel:${store.phone}`"
                  class="block py-2 text-[10px] sm:text-xs font-semibold text-amber-700 hover:bg-amber-100 active:bg-amber-200 rounded transition cursor-pointer"
                  :title="`${store.phone} に電話する`"
                >
                  要TEL
                </a>
                <span v-else class="block py-2 text-[10px] sm:text-xs font-semibold text-amber-700">
                  要TEL
                </span>
              </template>
              <span v-else-if="statusFor(day, time) === 'closed'" class="block py-2 text-slate-400 text-base">
                ―
              </span>
              <span v-else-if="statusFor(day, time) === 'past'" class="block py-2 text-slate-300 text-base select-none">
                ―
              </span>
              <span v-else class="block py-2 text-slate-300 text-base">
                ―
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-3 flex items-center gap-4 text-xs text-slate-600 flex-wrap">
      <span class="inline-flex items-center gap-1">
        <span class="text-red-600 font-extrabold text-base">◯</span> 空きあり
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="text-orange-600 font-extrabold text-base">△</span> 残り1枠
      </span>
      <span class="inline-flex items-center gap-1 px-1.5 rounded bg-amber-50">
        <span class="text-amber-700 font-semibold">要TEL</span> お電話でご相談ください
      </span>
      <span class="inline-flex items-center gap-1 px-1.5 rounded bg-slate-100">
        <span class="text-slate-400">―</span> 店休 / 営業時間外
      </span>
      <span class="inline-flex items-center gap-1 px-1.5 rounded bg-slate-50">
        <span class="text-slate-300">―</span> 受付終了
      </span>
    </div>

  </div>
</template>
