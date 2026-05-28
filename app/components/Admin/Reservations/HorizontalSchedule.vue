<script setup lang="ts">
// 予約スケジュール（横軸=時刻）。1 日分のスタッフ + ベッドを 1 つの TimeRowCalendar に混在表示する。
// 上段=スタッフ、下段=ベッドの順で並べる。
// 営業時間（BusinessHour）/ 国民の祝日（PublicHoliday）/ 店休日（Holiday）を反映し、
// 中抜け休憩や営業時間外を「使えない時間帯」としてオーバーレイ表示する。
import type { CalendarColumn, CalendarRange } from '../../Calendar/types'
import { displayStatus, type DbStatus } from '~~/shared/reservationStatus'
import { resolveBusinessHourDow, DOW_PUBLIC_HOLIDAY } from '~~/shared/businessHours'

const props = defineProps<{
  storeId: number
  date: string // YYYY-MM-DD
}>()

const emit = defineEmits<{
  (e: 'update:date', value: string): void
}>()

// ── ツールバー内部ステート ────────────────────────────
// アイコン説明ポップオーバーの開閉
const showIconLegend = ref(false)

// 最終更新日時（最新を表示ボタンで refresh したタイミング）
const lastUpdatedAt = ref<Date>(new Date())

// リフレッシュ中フラグ（最新を表示ボタンのアイコンを回転させる用）
const isRefreshing = ref(false)

// 週ビュー切替: スタッフ/ベッド名をクリックするとそのリソースの 7 日ビューに入る。
// null = 通常の日ビュー（行=スタッフ+ベッド）。値あり = 週ビュー（行=7 日分の日付）
type SelectedResource = { type: 'staff' | 'bed', id: number, name: string }
const selectedResource = ref<SelectedResource | null>(null)
const isWeeklyView = computed(() => selectedResource.value != null)

function exitWeeklyView() {
  selectedResource.value = null
}

// 現在時刻（HH:MM）。対象日が今日のときだけカレンダーに赤い縦線として渡す。
// 1 分毎に更新。SSR では時刻が確定しないので mounted 後にだけ走らせる。
const nowHHMM = ref<string>(currentHHMM())
function currentHHMM(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
let nowTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  nowHHMM.value = currentHHMM()
  nowTimer = setInterval(() => { nowHHMM.value = currentHHMM() }, 60_000)
})
onBeforeUnmount(() => {
  if (nowTimer != null) clearInterval(nowTimer)
})

// 対象日が「今日」かどうか（todayYmd() は app/utils/format.ts の auto-import 経由）
const isToday = computed(() => props.date === todayYmd())
// 「今」マーカー: 日ビューで今日のときだけ HH:MM を返す。週ビューでは不要なので null
const nowMarker = computed<string | null>(() => {
  if (isWeeklyView.value) return null
  return isToday.value ? nowHHMM.value : null
})

// ── データ取得 ─────────────────────────────────────────
type Bed = { id: number, name: string, displayOrder: number, isActive: boolean }
const { data: beds, refresh: refreshBeds } = await useFetch<Bed[]>(() => `/api/admin/stores/${props.storeId}/beds`, {
  default: () => [] as Bed[],
  watch: [() => props.storeId],
})

type Staff = {
  id: number
  storeId: number
  name: string
  gender: string | null
  role: string | null
  baseShiftDays: number[]
  displayOrder: number
  assignOrder: number
  isActive: boolean
  isAssignable: boolean
}
const { data: staff, refresh: refreshStaff } = await useFetch<Staff[]>('/api/admin/staff', {
  query: computed(() => ({ storeId: props.storeId, status: 'active', assignable: 'true' })),
  default: () => [] as Staff[],
  watch: [() => props.storeId],
})

type Reservation = {
  id: number
  status: DbStatus
  confirmationCode: string
  startAt: string
  endAt: string
  bed: { id: number, name: string }
  staff: { id: number, name: string }
  menu: { id: number, name: string, durationMinutes: number, priceJpy: number }
  customer: { id: number, name: string | null, phone: string | null, email: string | null }
}
type ListResponse = { items: Reservation[], total: number, totalPages: number }

// 週ビュー: props.date を起点に 6 日後までを範囲取得する
const fetchRangeTo = computed<string>(() => {
  if (!isWeeklyView.value || !/^\d{4}-\d{2}-\d{2}$/.test(props.date)) return props.date
  const d = new Date(`${props.date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 6)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
})

const { data: list, status: listStatus, refresh } = await useFetch<ListResponse>('/api/admin/reservations', {
  query: computed(() => ({
    storeId: props.storeId,
    from: props.date,
    to: fetchRangeTo.value,
    pageSize: 500,
  })),
  watch: [() => props.storeId, () => props.date, fetchRangeTo],
})

// 営業時間（曜日別レンジ）
type BizHour = { id: number, dayOfWeek: number, startTime: string, endTime: string }
const { data: businessHours, refresh: refreshBusinessHours } = await useFetch<BizHour[]>(() => `/api/admin/stores/${props.storeId}/business-hours`, {
  default: () => [] as BizHour[],
  watch: [() => props.storeId],
})

// 対象日の年（店休日 / 祝日の年絞り用）
const yearOfDate = computed(() => Number(props.date.slice(0, 4)) || new Date().getUTCFullYear())

// 店休日（その店舗・その年）
type Holiday = { id: number, date: string, note: string | null }
const { data: holidays, refresh: refreshHolidays } = await useFetch<Holiday[]>(() => `/api/admin/stores/${props.storeId}/holidays`, {
  query: computed(() => ({ year: yearOfDate.value })),
  default: () => [] as Holiday[],
  watch: [() => props.storeId, yearOfDate],
})

// 国民の祝日（全店共通）
type PubHoliday = { id: number, date: string, name: string }
const { data: publicHolidays, refresh: refreshPublicHolidays } = await useFetch<PubHoliday[]>('/api/admin/public-holidays', {
  query: computed(() => ({ year: yearOfDate.value })),
  default: () => [] as PubHoliday[],
  watch: [yearOfDate],
})

// ── 営業時間ロジック ─────────────────────────────────
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// JST 起点で対象日の曜日（0=日 … 6=土）を取得。
// 'YYYY-MM-DD' を UTC として解釈し getUTCDay() を使うと、サーバの TZ に依存せずに JST の曜日を得られる。
const fallbackDow = computed<number>(() => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(props.date)) return 0
  return new Date(`${props.date}T00:00:00Z`).getUTCDay()
})

const isPublicHoliday = computed(() => (publicHolidays.value ?? []).some(h => h.date === props.date))
const todayPublicHoliday = computed(() => (publicHolidays.value ?? []).find(h => h.date === props.date))
const isStoreHoliday = computed(() => (holidays.value ?? []).some(h => h.date === props.date))
const todayStoreHoliday = computed(() => (holidays.value ?? []).find(h => h.date === props.date))

const hasHolidayRanges = computed(() =>
  (businessHours.value ?? []).some(b => b.dayOfWeek === DOW_PUBLIC_HOLIDAY),
)

const effectiveDow = computed<number>(() =>
  resolveBusinessHourDow(isPublicHoliday.value, fallbackDow.value, hasHolidayRanges.value),
)

// その日のオープン時間帯（startTime 順）
const todayOpenRanges = computed<{ startTime: string, endTime: string }[]>(() => {
  return (businessHours.value ?? [])
    .filter(b => b.dayOfWeek === effectiveDow.value)
    .map(b => ({ startTime: b.startTime, endTime: b.endTime }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
})

// 表示窓: 営業時間にぴったり寄せる（floor/ceil で時間境界に丸める）。
// 営業日でないとき or 営業時間レンジが無いときは 9-21 を仮表示。
// 週ビューでは曜日ごとに営業時間が変わるため固定で 9-21 を使う。
const hourStart = computed<number>(() => {
  if (isWeeklyView.value) return 9
  if (todayOpenRanges.value.length === 0) return 9
  const mins = todayOpenRanges.value.map(r => toMin(r.startTime))
  return Math.floor(Math.min(...mins) / 60)
})
const hourEnd = computed<number>(() => {
  if (isWeeklyView.value) return 21
  if (todayOpenRanges.value.length === 0) return 21
  const mins = todayOpenRanges.value.map(r => toMin(r.endTime))
  return Math.ceil(Math.max(...mins) / 60)
})

// 営業時間外 / 中抜け休憩のオーバーレイ
const nonBusinessRanges = computed<{ startTime: string, endTime: string, label?: string }[]>(() => {
  // 週ビューは曜日ごとに営業時間が違うので、全行共通の overlay は出さない（誤情報を出さない）
  if (isWeeklyView.value) return []
  // 終日休業（店休日）は本体側で別表示にするのでここでは何もしない
  if (isStoreHoliday.value) return []

  const out: { startTime: string, endTime: string, label?: string }[] = []
  const winStart = hourStart.value * 60
  const winEnd = hourEnd.value * 60

  // 営業時間レンジ自体が無い日（祝日に -1 レンジも 0 レンジも無い等のレア）→ 全部「営業時間外」
  if (todayOpenRanges.value.length === 0) {
    out.push({
      startTime: `${pad2(hourStart.value)}:00`,
      endTime: `${pad2(hourEnd.value)}:00`,
      label: '営業時間外',
    })
    return out
  }

  // 開店前（hour 切り上げ分の余白）
  const first = todayOpenRanges.value[0]!
  if (toMin(first.startTime) > winStart) {
    out.push({ startTime: `${pad2(hourStart.value)}:00`, endTime: first.startTime })
  }
  // レンジ間 = 中抜け休憩
  for (let i = 0; i < todayOpenRanges.value.length - 1; i++) {
    const cur = todayOpenRanges.value[i]!
    const next = todayOpenRanges.value[i + 1]!
    if (toMin(next.startTime) > toMin(cur.endTime)) {
      out.push({ startTime: cur.endTime, endTime: next.startTime, label: '休憩中' })
    }
  }
  // 閉店後（hour 切り上げ分の余白）
  const last = todayOpenRanges.value[todayOpenRanges.value.length - 1]!
  if (toMin(last.endTime) < winEnd) {
    out.push({ startTime: last.endTime, endTime: `${pad2(hourEnd.value)}:00` })
  }
  return out
})

// ── 予約の整形 ─────────────────────────────────────────
const visibleReservations = computed<Reservation[]>(() =>
  (list.value?.items ?? []).filter(r => r.status === 'CONFIRMED'),
)
const hiddenCount = computed(() => (list.value?.items.length ?? 0) - visibleReservations.value.length)

const reservationMap = computed(() => {
  const m = new Map<string, Reservation>()
  for (const r of visibleReservations.value) {
    m.set(`staff-${r.id}`, r)
    m.set(`bed-${r.id}`, r)
    m.set(`wk-${r.id}`, r)
  }
  return m
})
function getReservationByRangeId(rangeId: string): Reservation | undefined {
  return reservationMap.value.get(rangeId)
}

// ── 列定義（上=スタッフ、下=ベッド） ──
const sortedStaff = computed<Staff[]>(() =>
  (staff.value ?? []).slice().sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id),
)
const sortedBeds = computed<Bed[]>(() =>
  (beds.value ?? [])
    .filter(b => b.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id),
)

// 週ビュー用の 7 日リスト（props.date から +6 日）
type WeekDay = { date: string, dow: number, isToday: boolean, monthDay: string }
const weekDays = computed<WeekDay[]>(() => {
  if (!isWeeklyView.value || !/^\d{4}-\d{2}-\d{2}$/.test(props.date)) return []
  const base = new Date(`${props.date}T00:00:00Z`)
  const today = todayYmd()
  const out: WeekDay[] = []
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(base.getTime() + offset * 24 * 3600_000)
    const ymd = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    const dow = d.getUTCDay()
    const dowLabel = '日月火水木金土'[dow]
    out.push({
      date: ymd,
      dow,
      isToday: ymd === today,
      monthDay: `${d.getUTCMonth() + 1}月${d.getUTCDate()}日(${dowLabel})`,
    })
  }
  return out
})

// ISO 文字列から JST の YYYY-MM-DD を抽出（週ビューのレンジを日付ごとに振り分ける用）
function jstYmdFromIso(iso: string): string {
  const d = new Date(iso)
  const jst = new Date(d.getTime() + 9 * 3600_000)
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`
}

// 指定日の非営業時間（営業時間外 + 中抜け休憩）を計算。週ビューの各日付列に渡す用。
function nonBusinessRangesForDate(ymd: string): { startTime: string, endTime: string, label?: string }[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return []
  const isPubHol = (publicHolidays.value ?? []).some(h => h.date === ymd)
  const isStoreHol = (holidays.value ?? []).some(h => h.date === ymd)
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay()
  const effDow = resolveBusinessHourDow(isPubHol, dow, hasHolidayRanges.value)

  const winStart = hourStart.value * 60
  const winEnd = hourEnd.value * 60
  const out: { startTime: string, endTime: string, label?: string }[] = []

  // 店休日 → 1 日丸ごと使えない
  if (isStoreHol) {
    out.push({
      startTime: `${pad2(hourStart.value)}:00`,
      endTime: `${pad2(hourEnd.value)}:00`,
      label: '店休日',
    })
    return out
  }

  const openRanges = (businessHours.value ?? [])
    .filter(b => b.dayOfWeek === effDow)
    .map(b => ({ startTime: b.startTime, endTime: b.endTime }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  // 営業時間レンジが無い → 全部営業時間外
  if (openRanges.length === 0) {
    out.push({
      startTime: `${pad2(hourStart.value)}:00`,
      endTime: `${pad2(hourEnd.value)}:00`,
      label: '営業時間外',
    })
    return out
  }

  const first = openRanges[0]!
  if (toMin(first.startTime) > winStart) {
    out.push({ startTime: `${pad2(hourStart.value)}:00`, endTime: first.startTime })
  }
  for (let i = 0; i < openRanges.length - 1; i++) {
    const cur = openRanges[i]!
    const next = openRanges[i + 1]!
    if (toMin(next.startTime) > toMin(cur.endTime)) {
      out.push({ startTime: cur.endTime, endTime: next.startTime, label: '休憩中' })
    }
  }
  const last = openRanges[openRanges.length - 1]!
  if (toMin(last.endTime) < winEnd) {
    out.push({ startTime: last.endTime, endTime: `${pad2(hourEnd.value)}:00` })
  }
  return out
}

const columns = computed<CalendarColumn[]>(() => {
  // 週ビュー: 行 = 7 日分の日付
  if (isWeeklyView.value) {
    const pubHolidayDates = new Set((publicHolidays.value ?? []).map(h => h.date))
    const storeHolidayDates = new Set((holidays.value ?? []).map(h => h.date))
    return weekDays.value.map((d) => {
      const isHolidayDate = pubHolidayDates.has(d.date) || storeHolidayDates.has(d.date)
      // 祝日 / 店休日 / 日曜=赤、土曜=青、平日=デフォルト（slate-800）
      const headerClass = isHolidayDate || d.dow === 0
        ? 'text-red-600'
        : d.dow === 6
          ? 'text-blue-600'
          : undefined
      // 行の背景: 今日が最優先 → 祝日/日曜は薄赤、土曜は薄青、平日は無し（店舗管理の営業時間と同じ）
      const bgClass = d.isToday
        ? 'bg-yellow-50'
        : isHolidayDate || d.dow === 0
          ? 'bg-red-50'
          : d.dow === 6
            ? 'bg-blue-50'
            : undefined
      return {
        id: `date-${d.date}`,
        label: d.monthDay,
        bgClass,
        headerClass,
        // 行ごとに営業時間外 / 中抜け休憩を計算（曜日 + 祝日 + 店休日 を反映）
        nonBusinessRanges: nonBusinessRangesForDate(d.date),
      }
    })
  }
  // 日ビュー: 上=スタッフ / 下=ベッド
  const staffCols: CalendarColumn[] = sortedStaff.value.map(s => ({
    id: `staff-${s.id}`,
    label: s.name,
  }))
  const bedCols: CalendarColumn[] = sortedBeds.value.map((b, idx) => ({
    id: `bed-${b.id}`,
    label: b.name,
    // ベッド行は行ラベル + トラックを薄い orange tint にして、スタッフ群と区別する
    bgClass: 'bg-orange-50',
    // ベッド先頭行だけ上に太い orange の帯を入れて、スタッフ群との区切りにする
    rowClass: idx === 0 ? 'border-t-[14px] border-orange-300' : undefined,
  }))
  return [...staffCols, ...bedCols]
})

const ranges = computed<CalendarRange[]>(() => {
  // 週ビュー: 選択中スタッフ/ベッド だけの予約を、開始日の日付列に振り分ける
  if (isWeeklyView.value && selectedResource.value) {
    const { type, id } = selectedResource.value
    return visibleReservations.value
      .filter(r => type === 'staff' ? r.staff.id === id : r.bed.id === id)
      .map(r => ({
        id: `wk-${r.id}`,
        columnId: `date-${jstYmdFromIso(r.startAt)}`,
        startTime: fmtJstTime(r.startAt),
        endTime: fmtJstTime(r.endAt),
      }))
  }
  // 日ビュー: 同じ予約をスタッフ行とベッド行の両方に展開
  const out: CalendarRange[] = []
  for (const r of visibleReservations.value) {
    out.push({
      id: `staff-${r.id}`,
      columnId: `staff-${r.staff.id}`,
      startTime: fmtJstTime(r.startAt),
      endTime: fmtJstTime(r.endAt),
    })
    out.push({
      id: `bed-${r.id}`,
      columnId: `bed-${r.bed.id}`,
      startTime: fmtJstTime(r.startAt),
      endTime: fmtJstTime(r.endAt),
    })
  }
  return out
})

// ── 表示色 ─────────────────────────────────────────────
function statusColorClasses(r: Reservation): string {
  const s = displayStatus(r.status, r.endAt)
  if (s === 'UPCOMING') return 'bg-green-100 border-green-400 text-green-900'
  if (s === 'COMPLETED') return 'bg-blue-100 border-blue-400 text-blue-900'
  return 'bg-slate-100 border-slate-300 text-slate-700'
}

const hasAnyRow = computed(() => columns.value.length > 0)

// 今日の状態テキスト（凡例横に出す簡易ラベル）
const todayStatusLabel = computed<string | null>(() => {
  if (isStoreHoliday.value) {
    return todayStoreHoliday.value?.note ? `店休日（${todayStoreHoliday.value.note}）` : '店休日'
  }
  if (isPublicHoliday.value) {
    return `祝日（${todayPublicHoliday.value?.name ?? ''}）`
  }
  return null
})

// ── ツールバー用ヘルパ ────────────────────────────────
// '5月28日（木）' 形式に整形（週ビュー時は '5月28日（木）〜6月3日（水）'）
const formattedDate = computed<string>(() => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(props.date)) return ''
  const start = new Date(`${props.date}T00:00:00Z`)
  const startStr = `${start.getUTCMonth() + 1}月${start.getUTCDate()}日（${'日月火水木金土'[start.getUTCDay()]}）`
  if (!isWeeklyView.value) return startStr
  const end = new Date(start.getTime() + 6 * 24 * 3600_000)
  const endStr = `${end.getUTCMonth() + 1}月${end.getUTCDate()}日（${'日月火水木金土'[end.getUTCDay()]}）`
  return `${startStr} 〜 ${endStr}`
})

// 行ラベル（スタッフ/ベッド）クリック → そのリソースの週ビューに切替
function onRowLabelClick(column: CalendarColumn) {
  if (isWeeklyView.value) return
  const idStr = String(column.id)
  if (idStr.startsWith('staff-')) {
    const id = Number(idStr.slice(6))
    const s = sortedStaff.value.find(x => x.id === id)
    if (s) selectedResource.value = { type: 'staff', id, name: s.name }
  }
  else if (idStr.startsWith('bed-')) {
    const id = Number(idStr.slice(4))
    const b = sortedBeds.value.find(x => x.id === id)
    if (b) selectedResource.value = { type: 'bed', id, name: b.name }
  }
}

// 最終更新日時 'MM/DD HH:MM'
const formattedLastUpdate = computed<string>(() => {
  const d = lastUpdatedAt.value
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
})

// 日付の色クラス（祝日・店休日・日曜=赤 / 土曜=青 / 平日=黒）
// 週ビューはレンジ表示なので色を変えない（slate-900 固定）
const dateColorClass = computed<string>(() => {
  if (isWeeklyView.value) return 'text-slate-900'
  if (isPublicHoliday.value || isStoreHoliday.value) return 'text-red-600'
  if (fallbackDow.value === 0) return 'text-red-600'
  if (fallbackDow.value === 6) return 'text-blue-600'
  return 'text-slate-900'
})

// テーブル下の日付ストリップ用の ±N 日リスト
// パターンは「-2 〜 +9」（今日を 3 番目に置いてやや右に長め。スクショに合わせた）
type StripDay = { date: string, day: number, dow: number, isToday: boolean, isSelected: boolean }
const dateStripDays = computed<StripDay[]>(() => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(props.date)) return []
  const base = new Date(`${props.date}T00:00:00Z`)
  const today = todayYmd()
  const out: StripDay[] = []
  for (let offset = -2; offset <= 9; offset++) {
    const d = new Date(base.getTime() + offset * 24 * 3600_000)
    const ymd = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    out.push({
      date: ymd,
      day: d.getUTCDate(),
      dow: d.getUTCDay(),
      isToday: ymd === today,
      isSelected: ymd === props.date,
    })
  }
  return out
})

function goToToday() {
  emit('update:date', todayYmd())
}
function jumpToDate(ymd: string) {
  emit('update:date', ymd)
}

// カレンダーピッカー（2 ヶ月並びポップオーバー）の開閉。
// アンカー位置を持つことで、上部ツールバーの日付テキスト / 下部 📅 ボタンのどちらから開いても、
// クリックした側に近い位置にポップオーバーを表示する。
type DatePickerAnchor = 'top' | 'bottom' | null
const datePickerAnchor = ref<DatePickerAnchor>(null)
function toggleDatePickerAt(anchor: 'top' | 'bottom') {
  datePickerAnchor.value = datePickerAnchor.value === anchor ? null : anchor
}
function closeDatePicker() {
  datePickerAnchor.value = null
}
function onDatePickerSelect(v: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) emit('update:date', v)
}

// 日付シフト（±N 日）→ 親に通知
function shiftDay(days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(props.date)) return
  const d = new Date(`${props.date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  const next = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  emit('update:date', next)
}

// 最新を表示: 全 fetch を再走 + 更新時刻を打刻。実行中は isRefreshing=true でアイコンを回転させる
async function handleRefresh() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await Promise.all([
      refresh(),
      refreshBeds(),
      refreshStaff(),
      refreshBusinessHours(),
      refreshHolidays(),
      refreshPublicHolidays(),
    ])
    lastUpdatedAt.value = new Date()
  }
  finally {
    isRefreshing.value = false
  }
}

// データ反映完了を判定するのが面倒なので、props.date / storeId 切替時にも打刻を更新
watch([() => props.date, () => props.storeId], () => {
  lastUpdatedAt.value = new Date()
})

defineExpose({ refresh: handleRefresh })
</script>

<template>
  <div class="space-y-2">
    <!-- ツールバー（日付ナビ + アクション。枠なし、ページ背景に直接置く） -->
    <div class="px-1 py-1 flex items-center gap-3 flex-wrap text-sm relative">
      <!-- 日付ナビ ◀ 5月28日（木）▶ -->
      <div class="flex items-center gap-1.5 relative">
        <!-- 前日矢印（日ビューのみ。週ビューはカレンダーから直接ジャンプする） -->
        <button
          v-if="!isWeeklyView"
          type="button"
          class="size-8 inline-flex items-center justify-center rounded-full text-orange-500 hover:text-orange-700 hover:bg-orange-100 transition-colors"
          title="前日"
          @click="shiftDay(-1)"
        >
          <UIcon name="i-lucide-chevron-left" class="size-6" />
        </button>
        <!-- 日付テキスト（クリックでカレンダーピッカーを開く） -->
        <button
          type="button"
          class="font-extrabold text-2xl px-2 py-0.5 tabular-nums whitespace-nowrap tracking-tight rounded-sm hover:bg-slate-100 cursor-pointer transition-colors"
          :class="dateColorClass"
          :title="isWeeklyView ? 'クリックで週の開始日を変更' : 'クリックで日付を変更'"
          @click="toggleDatePickerAt('top')"
        >
          {{ formattedDate }}
        </button>
        <!-- 翌日矢印（日ビューのみ） -->
        <button
          v-if="!isWeeklyView"
          type="button"
          class="size-8 inline-flex items-center justify-center rounded-full text-orange-500 hover:text-orange-700 hover:bg-orange-100 transition-colors"
          title="翌日"
          @click="shiftDay(1)"
        >
          <UIcon name="i-lucide-chevron-right" class="size-6" />
        </button>
        <!-- 祝日 / 店休日 のときは日付横にラベルも添える -->
        <span
          v-if="todayStatusLabel"
          class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-sm border border-red-300 bg-red-50 text-red-700 text-[11px] font-semibold"
        >
          {{ todayStatusLabel }}
        </span>
        <!-- 上部カレンダーピッカー（日付テキスト直下に展開） -->
        <div
          v-if="datePickerAnchor === 'top'"
          class="absolute left-0 top-full mt-2 z-30"
          @click.stop
        >
          <AdminReservationsDatePickerPopover
            :model-value="props.date"
            :public-holidays="publicHolidays ?? []"
            :store-holidays="holidays ?? []"
            @update:model-value="onDatePickerSelect"
            @close="closeDatePicker"
          />
        </div>
      </div>

      <!-- 右側アクション群 -->
      <div class="ml-auto flex items-center gap-2 flex-wrap">
        <!-- アイコン説明（ポップオーバー） -->
        <div class="relative">
          <button
            type="button"
            class="px-2 py-1 text-xs rounded-sm bg-[#f0f0f1] hover:bg-[#e6e6e8] text-slate-700 border border-[#c3c4c7] inline-flex items-center gap-1"
            @click="showIconLegend = !showIconLegend"
          >
            <UIcon name="i-lucide-info" class="size-3.5" />
            アイコン説明
          </button>
          <!-- 凡例ポップオーバー -->
          <div
            v-if="showIconLegend"
            class="absolute right-0 top-full mt-1 z-20 bg-white border border-[#c3c4c7] rounded-sm shadow-md p-3 w-56 text-xs space-y-1.5"
            @click.stop
          >
            <div class="font-semibold text-slate-700 border-b border-[#dcdcde] pb-1 mb-1">凡例</div>
            <div class="flex items-center gap-2">
              <span class="inline-block w-4 h-3 rounded-sm bg-green-100 border border-green-400" />
              <span>予約済（これから）</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="inline-block w-4 h-3 rounded-sm bg-blue-100 border border-blue-400" />
              <span>完了（来店済み）</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="inline-block w-4 h-3 rounded-sm bg-[repeating-linear-gradient(45deg,_transparent,_transparent_2px,_#e5e7eb_2px,_#e5e7eb_4px)] border border-slate-300" />
              <span>営業時間外 / 休憩中</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="inline-block w-4 h-3 rounded-sm bg-orange-50 border border-orange-300" />
              <span>ベッド行</span>
            </div>
          </div>
        </div>

        <!-- 最新を表示（リフレッシュ中はアイコン回転） -->
        <button
          type="button"
          class="px-2 py-1 text-xs rounded-sm bg-red-500 hover:bg-red-600 text-white inline-flex items-center gap-1 font-semibold disabled:opacity-70"
          :disabled="isRefreshing"
          @click="handleRefresh"
        >
          <UIcon
            name="i-lucide-refresh-cw"
            class="size-3.5"
            :class="{ 'animate-spin': isRefreshing }"
          />
          最新を表示
        </button>

        <!-- 更新日時 -->
        <span class="text-xs text-slate-500 tabular-nums whitespace-nowrap">
          更新日時：{{ formattedLastUpdate }}
        </span>
      </div>
    </div>

    <!-- 週ビューのサブヘッダ（戻るボタン + タイトル）-->
    <div
      v-if="isWeeklyView && selectedResource"
      class="flex items-center gap-2 px-1"
    >
      <button
        type="button"
        class="px-2.5 py-1 text-xs rounded-sm bg-slate-700 hover:bg-slate-800 text-white inline-flex items-center gap-1 font-semibold"
        @click="exitWeeklyView"
      >
        <UIcon name="i-lucide-arrow-left" class="size-3.5" />
        全体ビューに戻る
      </button>
      <span class="text-base font-bold text-slate-800">
        {{ selectedResource.name }}
        <span class="text-xs text-slate-500 font-normal ml-1">の {{ selectedResource.type === 'staff' ? 'スタッフ' : 'ベッド' }} スケジュール</span>
      </span>
    </div>

    <!-- 店休日（日ビューのみ）-->
    <div
      v-if="!isWeeklyView && isStoreHoliday"
      class="bg-white border border-[#c3c4c7] rounded-sm p-10 text-center"
    >
      <UIcon name="i-lucide-store" class="size-8 text-slate-400 mx-auto mb-2" />
      <p class="text-sm font-semibold text-slate-700">
        本日は店休日です
      </p>
      <p v-if="todayStoreHoliday?.note" class="text-xs text-slate-500 mt-1">
        {{ todayStoreHoliday.note }}
      </p>
    </div>

    <!-- 行が無い時（日ビューのみ）-->
    <div
      v-else-if="!isWeeklyView && !hasAnyRow"
      class="bg-white border border-[#c3c4c7] rounded-sm p-8 text-center text-sm text-slate-500"
    >
      この店舗にはスタッフ・ベッドが登録されていません
    </div>

    <!-- スケジュール本体（週ビュー / 日ビューの通常時）-->
    <div v-else class="bg-white border border-[#c3c4c7] rounded-sm overflow-hidden">
      <CalendarTimeRowCalendar
        :columns="columns"
        :ranges="ranges"
        :non-business-ranges="nonBusinessRanges"
        :now-marker="nowMarker"
        :hour-start="hourStart"
        :hour-end="hourEnd"
        :hour-px="48"
        :allow-edit="false"
        :max-ranges-per-column="null"
        :row-label-width="100"
        :row-height="48"
        bar-cursor="default"
        empty-label=""
      >
        <!-- 行ラベル（日ビューではスタッフ/ベッド名がクリッカブル、週ビューでは日付なのでクリック不可） -->
        <template #row-label="{ column }">
          <button
            v-if="!isWeeklyView"
            type="button"
            class="w-full h-full px-1 inline-flex items-center justify-center gap-0.5 text-sm font-bold text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            :title="`${column.label} の週ビューを表示`"
            @click="onRowLabelClick(column)"
          >
            <span class="truncate underline decoration-slate-400 decoration-dotted underline-offset-2 hover:decoration-slate-700 hover:decoration-solid">{{ column.label }}</span>
            <UIcon name="i-lucide-chevron-right" class="size-3.5 shrink-0 text-orange-500" />
          </button>
          <span v-else class="text-sm font-bold" :class="column.headerClass ?? 'text-slate-800'">{{ column.label }}</span>
        </template>
        <template #bar="{ range }">
          <div
            v-if="getReservationByRangeId(range.id)"
            class="absolute inset-0 rounded-sm border px-1.5 py-1 overflow-hidden pointer-events-none flex flex-col justify-center"
            :class="statusColorClasses(getReservationByRangeId(range.id)!)"
          >
            <div class="text-[11px] font-semibold leading-tight truncate">
              {{ getReservationByRangeId(range.id)!.menu.name }}
            </div>
            <div class="text-[10px] leading-tight truncate opacity-80">
              {{ getReservationByRangeId(range.id)!.customer.name ?? '(復号失敗)' }}
            </div>
          </div>
        </template>
      </CalendarTimeRowCalendar>
    </div>

    <!-- テーブル下の日付ジャンプストリップ（枠なし・背景なし、ページに直置き） -->
    <div class="px-1 py-1 flex items-center gap-1 flex-wrap">
      <!-- カレンダーから日付を選ぶ（2 ヶ月並びの自作ポップオーバー） -->
      <div class="relative">
        <button
          type="button"
          class="p-1.5 rounded-sm bg-orange-500 hover:bg-orange-600 text-white inline-flex items-center justify-center shadow-sm"
          title="カレンダーから日付を選ぶ"
          @click="toggleDatePickerAt('bottom')"
        >
          <UIcon name="i-lucide-calendar-days" class="size-4" />
        </button>
        <!-- 2 ヶ月並びカレンダー（ボタン直上に展開） -->
        <div
          v-if="datePickerAnchor === 'bottom'"
          class="absolute left-0 bottom-full mb-2 z-30"
          @click.stop
        >
          <AdminReservationsDatePickerPopover
            :model-value="props.date"
            :public-holidays="publicHolidays ?? []"
            :store-holidays="holidays ?? []"
            @update:model-value="onDatePickerSelect"
            @close="closeDatePicker"
          />
        </div>
      </div>

      <!-- 今日 -->
      <button
        type="button"
        class="px-2.5 py-1 text-xs rounded-sm bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-sm"
        @click="goToToday"
      >
        今日
      </button>

      <!-- 前の日 -->
      <button
        type="button"
        class="px-2.5 py-1 text-xs rounded-sm bg-orange-500 hover:bg-orange-600 text-white font-semibold inline-flex items-center gap-0.5 shadow-sm"
        @click="shiftDay(-1)"
      >
        <UIcon name="i-lucide-chevron-left" class="size-3" />
        前の日
      </button>

      <!-- 日付ボタン群 -->
      <div class="flex items-center gap-0.5 px-1">
        <button
          v-for="d in dateStripDays"
          :key="d.date"
          type="button"
          class="size-7 inline-flex items-center justify-center text-xs tabular-nums rounded-full transition-colors"
          :class="d.isSelected
            ? 'bg-orange-500 text-white font-bold hover:bg-orange-600 shadow-sm'
            : [
              d.dow === 0 ? 'text-red-600' : d.dow === 6 ? 'text-blue-600' : 'text-slate-700',
              'hover:bg-slate-100',
            ]"
          :title="d.date"
          @click="jumpToDate(d.date)"
        >
          {{ d.day }}
        </button>
      </div>

      <!-- 次の日 -->
      <button
        type="button"
        class="px-2.5 py-1 text-xs rounded-sm bg-orange-500 hover:bg-orange-600 text-white font-semibold inline-flex items-center gap-0.5 shadow-sm"
        @click="shiftDay(1)"
      >
        次の日
        <UIcon name="i-lucide-chevron-right" class="size-3" />
      </button>
    </div>
  </div>
</template>
