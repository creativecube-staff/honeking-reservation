<script setup lang="ts">
// 予約フロー 2/4: 日時選択（時刻×曜日グリッド）
const route = useRoute()
const router = useRouter()
const slug = computed(() => String(route.params.slug ?? ''))
const menuId = computed(() => Number(route.params.menuId ?? 0))

type Store = {
  id: number
  slug: string
  prefecture: string
  city: string
  name: string
  address: string
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
const offsetYmd = computed<string>({
  get() {
    const q = String(route.query.from ?? '')
    return /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayYmd()
  },
  set(v) {
    router.replace({ query: { ...route.query, from: v } })
  },
})

const rangeFrom = computed(() => offsetYmd.value)
const rangeTo = computed(() => addDays(offsetYmd.value, WEEK_DAYS - 1))

const { data: store, error: storeError } = await useFetch<Store>(() => `/api/stores/${slug.value}`)
const { data: menus } = await useFetch<Menu[]>(() => `/api/stores/${slug.value}/menus`)
const menu = computed<Menu | null>(() => (menus.value ?? []).find(m => m.id === menuId.value) ?? null)

const { data: availability, status, error: availError } = await useFetch<DayAvail[]>('/api/availability', {
  query: computed(() => ({
    slug: slug.value,
    menuId: menuId.value,
    from: rangeFrom.value,
    to: rangeTo.value,
  })),
  watch: [rangeFrom, rangeTo, menuId],
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
  const duration = menu.value?.durationMinutes ?? 30
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

// startAt 形式: "YYYY-MM-DDTHHMM"（URL に : を含めないため 4 桁時刻）
function onSelectSlot(ymd: string, time: string) {
  const startAt = `${ymd}T${time.replace(':', '')}`
  router.push(`/${slug.value}/${menuId.value}/${startAt}/confirm`)
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
  <div class="mx-auto max-w-5xl px-4 sm:px-6 py-8">
    <ol class="flex items-center text-xs sm:text-sm text-slate-500 mb-6 gap-2">
      <li class="flex items-center gap-1">
        <span class="size-6 rounded-full bg-slate-300 text-white flex items-center justify-center text-xs">1</span>
        <span>店舗</span>
      </li>
      <li class="text-slate-300">→</li>
      <li class="flex items-center gap-1">
        <span class="size-6 rounded-full bg-slate-300 text-white flex items-center justify-center text-xs">2</span>
        <span>メニュー</span>
      </li>
      <li class="text-slate-300">→</li>
      <li class="flex items-center gap-1 font-semibold text-orange-700">
        <span class="size-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs">3</span>
        <span>日時</span>
      </li>
      <li class="text-slate-300">→</li>
      <li class="flex items-center gap-1">
        <span class="size-6 rounded-full bg-slate-300 text-white flex items-center justify-center text-xs">4</span>
        <span>確認</span>
      </li>
    </ol>

    <UAlert
      v-if="storeError"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`店舗の取得に失敗しました: ${storeError.message}`"
    />

    <div v-else-if="store && menu">
      <div class="rounded-xl border border-amber-300 bg-[#fff3db] p-4 mb-6">
        <p class="text-xs text-slate-600">
          {{ store.name }} で予約中
        </p>
        <h2 class="text-lg font-bold text-slate-900 mt-1">
          {{ menu.name }}
        </h2>
        <p class="text-sm text-slate-700 mt-1">
          所要時間: {{ duration(menu.durationMinutes) }} / ¥{{ yen(menu.priceJpy) }}
        </p>
        <NuxtLink
          :to="`/${slug}`"
          class="mt-2 inline-flex items-center gap-1 text-xs text-slate-600 hover:text-orange-700"
        >
          <UIcon name="i-lucide-chevron-left" class="size-4" />
          メニューを変更
        </NuxtLink>
      </div>

      <h1 class="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
        日時を選択
      </h1>
      <p class="text-sm text-slate-700 mb-4">
        ご希望の時間枠（◯）をタップしてご予約に進んでください。
      </p>

      <div class="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
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
            class="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
            :disabled="rangeFrom === todayYmd()"
            @click="offsetYmd = todayYmd()"
          >
            今週
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50"
            @click="shiftRange(WEEK_DAYS)"
          >
            次の週 →
          </button>
        </div>
      </div>

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
                    :title="`${day.date} ${time} を予約する（残り1枠）`"
                    @click="onSelectSlot(day.date, time)"
                  >
                    △
                  </button>
                </template>
                <span v-else-if="statusFor(day, time) === 'fullyBooked'" class="block py-2 text-[10px] sm:text-xs font-semibold text-amber-700">
                  要TEL
                </span>
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
          <span class="text-amber-700 font-semibold">要TEL</span> 満枠（お電話でご相談ください）
        </span>
        <span class="inline-flex items-center gap-1 px-1.5 rounded bg-slate-100">
          <span class="text-slate-400">―</span> 店休 / 営業時間外
        </span>
        <span class="inline-flex items-center gap-1 px-1.5 rounded bg-slate-50">
          <span class="text-slate-300">―</span> 受付終了
        </span>
      </div>

      <div class="mt-8">
        <NuxtLink
          :to="`/${slug}`"
          class="text-sm text-slate-600 hover:text-orange-700 inline-flex items-center gap-1"
        >
          <UIcon name="i-lucide-chevron-left" class="size-4" />
          メニュー選択に戻る
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
