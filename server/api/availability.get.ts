import { MAX_ADVANCE_DAYS } from '~~/shared/reservationPolicy'
import { prisma } from '../utils/prisma'

// お客様側: 指定店舗・指定メニューの空き枠を期間で返す。
// クエリ: ?slug=otakanomori&menuId=3&from=YYYY-MM-DD&to=YYYY-MM-DD
//
// 戻り値: [{ date, isClosed, isHoliday, isPublicHoliday, publicHolidayName, slots: ['09:30', '10:00', ...] }]
//
// アルゴリズム:
// 1. 期間内の各日付について
//    - PublicHoliday なら日曜扱い、そうでなければ getUTCDay()
//    - Holiday に該当なら slots 空
//    - その曜日の BusinessHour レンジを取得
//    - 各レンジ内で 30 分刻みのスロット候補を生成し、メニュー時間 + 制約をすべて満たすものだけ採用
//      - スロット範囲が Closure と重ならない
//      - 空きベッドが 1 つ以上存在
//      - その店舗で勤務するスタッフのうち、シフトが [start, end] を含み、かつ
//        その時間に他の予約が無いスタッフが 1 名以上存在

const SLOT_STEP_MIN = 30

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function parseHm(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}
function formatHm(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}
function ymdOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const slug = typeof query.slug === 'string' ? query.slug : ''
  const menuId = Number(query.menuId)
  const from = typeof query.from === 'string' ? query.from : ''
  const to = typeof query.to === 'string' ? query.to : ''

  if (!slug) throw createError({ statusCode: 400, statusMessage: 'slug を指定してください' })
  if (!Number.isInteger(menuId) || menuId <= 0) throw createError({ statusCode: 400, statusMessage: 'menuId を指定してください' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw createError({ statusCode: 400, statusMessage: 'from / to は YYYY-MM-DD' })
  }

  const fromDate = new Date(`${from}T00:00:00Z`)
  const toDate = new Date(`${to}T00:00:00Z`)
  if (fromDate > toDate) throw createError({ statusCode: 400, statusMessage: 'from は to 以前' })
  const dayDiff = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000)
  if (dayDiff > 60) throw createError({ statusCode: 400, statusMessage: '期間は 60 日以内' })

  // 受付上限を超える期間は弾く(UI 側で disabled にしているが、直叩き対策)。
  const todayUtc = new Date()
  todayUtc.setUTCHours(0, 0, 0, 0)
  const maxAllowed = new Date(todayUtc)
  maxAllowed.setUTCDate(maxAllowed.getUTCDate() + MAX_ADVANCE_DAYS - 1)
  if (fromDate > maxAllowed) {
    throw createError({ statusCode: 400, statusMessage: `ご予約は本日から ${MAX_ADVANCE_DAYS} 日先までお受けしております` })
  }

  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, isActive: true },
  })
  if (!store || !store.isActive) throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })

  const menu = await prisma.menu.findUnique({
    where: { id: menuId },
    select: {
      id: true,
      storeId: true,
      durationMinutes: true,
      isActive: true,
      availableFrom: true,
      availableUntil: true,
    },
  })
  if (!menu || !menu.isActive) throw createError({ statusCode: 404, statusMessage: 'メニューが見つかりません' })
  if (menu.storeId !== null && menu.storeId !== store.id) {
    throw createError({ statusCode: 400, statusMessage: 'このメニューは指定店舗で利用できません' })
  }

  // 期間内の関連データをまとめて取得
  const [businessHours, holidays, closures, publicHolidays, beds, practitioners, shifts, reservations] = await Promise.all([
    prisma.businessHour.findMany({ where: { storeId: store.id } }),
    prisma.holiday.findMany({ where: { storeId: store.id, date: { gte: fromDate, lte: toDate } } }),
    prisma.closure.findMany({ where: { storeId: store.id, date: { gte: fromDate, lte: toDate } } }),
    prisma.publicHoliday.findMany({ where: { date: { gte: fromDate, lte: toDate } } }),
    prisma.bed.findMany({ where: { storeId: store.id, isActive: true }, select: { id: true } }),
    // 予約に割り当て可能なスタッフのみ（オーナー等の特別アカウントは除外）
    prisma.practitioner.findMany({ where: { isActive: true, isAssignable: true }, select: { id: true, storeId: true } }),
    // この店舗で勤務するシフト = workStoreId が当店 OR (workStoreId IS NULL AND practitioner.storeId = 当店)
    prisma.shift.findMany({
      where: {
        date: { gte: fromDate, lte: toDate },
        OR: [
          { workStoreId: store.id },
          { workStoreId: null, practitioner: { storeId: store.id } },
        ],
      },
      select: { practitionerId: true, date: true, startTime: true, endTime: true, workStoreId: true },
    }),
    // この店舗の CONFIRMED 予約
    prisma.reservation.findMany({
      where: {
        storeId: store.id,
        status: 'CONFIRMED',
        startAt: { gte: fromDate, lt: new Date(toDate.getTime() + 86400000) },
      },
      select: { bedId: true, practitionerId: true, startAt: true, endAt: true },
    }),
  ])

  // 各スタッフの「メイン店舗以外でも勤務しうる」予約も検索する必要がある（他店ヘルプ中の人が当店予約とブッキングしないように）
  // …は practitionerId 単位で当店の reservations を見るだけで十分（他店との衝突は他店の availability で別途検証される）。

  // ─ 索引作成 ─
  const holidayDates = new Set(holidays.map(h => ymdOf(h.date)))
  const publicHolidayMap = new Map(publicHolidays.map(p => [ymdOf(p.date), p.name]))
  const closuresByDate = new Map<string, { startMin: number, endMin: number }[]>()
  for (const c of closures) {
    const key = ymdOf(c.date)
    if (!closuresByDate.has(key)) closuresByDate.set(key, [])
    closuresByDate.get(key)!.push({ startMin: parseHm(c.startTime), endMin: parseHm(c.endTime) })
  }
  const shiftsByDateStaff = new Map<string, { startMin: number, endMin: number }>()
  for (const s of shifts) {
    const key = `${ymdOf(s.date)}:${s.practitionerId}`
    shiftsByDateStaff.set(key, { startMin: parseHm(s.startTime), endMin: parseHm(s.endTime) })
  }
  // (date, practitionerId) → 予約レンジ list  ※ 時刻は JST 日内分（BusinessHour と同じ基準）
  const reservationsByDateStaff = new Map<string, { startMin: number, endMin: number }[]>()
  // (date, bedId) → 予約レンジ list
  const reservationsByDateBed = new Map<string, { startMin: number, endMin: number }[]>()
  // ヘルパ: UTC 保存のタイムスタンプを JST 日付 + JST 分に変換
  function toJstYmdMin(d: Date): { ymd: string, min: number } {
    const jst = new Date(d.getTime() + 9 * 3600_000)
    return {
      ymd: `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`,
      min: jst.getUTCHours() * 60 + jst.getUTCMinutes(),
    }
  }
  for (const r of reservations) {
    const start = toJstYmdMin(new Date(r.startAt))
    const end = toJstYmdMin(new Date(r.endAt))
    // 日跨ぎ予約は想定していない（営業時間内なので発生しない）が、念のため start 側の日に紐付ける
    const key = start.ymd
    const range = { startMin: start.min, endMin: end.min }
    const kStaff = `${key}:${r.practitionerId}`
    if (!reservationsByDateStaff.has(kStaff)) reservationsByDateStaff.set(kStaff, [])
    reservationsByDateStaff.get(kStaff)!.push(range)
    const kBed = `${key}:${r.bedId}`
    if (!reservationsByDateBed.has(kBed)) reservationsByDateBed.set(kBed, [])
    reservationsByDateBed.get(kBed)!.push(range)
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  function overlapsAny(ranges: { startMin: number, endMin: number }[], sStart: number, sEnd: number): boolean {
    for (const r of ranges) {
      if (r.startMin < sEnd && r.endMin > sStart) return true
    }
    return false
  }

  type SlotOut = {
    time: string
    /** 残り枠数 = min(空きベッド数, 空きスタッフ数)。0 なら満枠（要 TEL）、1 なら最後の枠（△）、2 以上は ○ */
    capacity: number
  }
  type DayOut = {
    date: string
    isClosed: boolean
    isHoliday: boolean
    isPublicHoliday: boolean
    publicHolidayName: string | null
    /** 営業時間内のスロット候補。capacity=0 でも入る（要 TEL 表示用）。
     *  休憩中・営業時間外は含まれない */
    slots: SlotOut[]
    openTime: string | null
    closeTime: string | null
  }
  const result: DayOut[] = []

  for (let i = 0; i <= dayDiff; i++) {
    const d = new Date(fromDate)
    d.setUTCDate(d.getUTCDate() + i)
    const ymd = ymdOf(d)
    const pubName = publicHolidayMap.get(ymd) ?? null
    const isPublicHoliday = !!pubName
    const dayOfWeek = isPublicHoliday ? 0 : d.getUTCDay()
    const isHoliday = holidayDates.has(ymd)

    // メニューの表示期間
    const isWithinMenuPeriod = (
      (!menu.availableFrom || d >= menu.availableFrom)
      && (!menu.availableUntil || d <= menu.availableUntil)
    )
    // 今日より過去は不可
    const isPast = d < today

    if (isHoliday || isPast || !isWithinMenuPeriod) {
      result.push({
        date: ymd,
        isClosed: isHoliday,
        isHoliday,
        isPublicHoliday,
        publicHolidayName: pubName,
        slots: [],
        openTime: null,
        closeTime: null,
      })
      continue
    }

    const ranges = businessHours
      .filter(b => b.dayOfWeek === dayOfWeek)
      .map(b => ({ startMin: parseHm(b.startTime), endMin: parseHm(b.endTime) }))
      .sort((a, b) => a.startMin - b.startMin)

    if (ranges.length === 0) {
      result.push({
        date: ymd,
        isClosed: true,
        isHoliday: false,
        isPublicHoliday,
        publicHolidayName: pubName,
        slots: [],
        openTime: null,
        closeTime: null,
      })
      continue
    }

    const dayClosures = closuresByDate.get(ymd) ?? []
    const slots: SlotOut[] = []

    for (const range of ranges) {
      // スロット候補は SLOT_STEP_MIN 刻み
      for (let s = range.startMin; s + menu.durationMinutes <= range.endMin; s += SLOT_STEP_MIN) {
        const e = s + menu.durationMinutes
        // Closure と重なるなら不可（時間軸的にも候補から外す）
        if (overlapsAny(dayClosures, s, e)) continue

        // 空きベッド数
        let freeBeds = 0
        for (const bed of beds) {
          const rs = reservationsByDateBed.get(`${ymd}:${bed.id}`) ?? []
          if (!overlapsAny(rs, s, e)) freeBeds++
        }

        // 空きスタッフ数（当店勤務 + シフトが含む + 他予約と被らない）
        let freeStaff = 0
        for (const p of practitioners) {
          const shift = shiftsByDateStaff.get(`${ymd}:${p.id}`)
          if (!shift) continue
          if (shift.startMin > s || shift.endMin < e) continue
          const rs = reservationsByDateStaff.get(`${ymd}:${p.id}`) ?? []
          if (overlapsAny(rs, s, e)) continue
          freeStaff++
        }

        const capacity = Math.min(freeBeds, freeStaff)
        slots.push({ time: formatHm(s), capacity })
      }
    }

    result.push({
      date: ymd,
      isClosed: false,
      isHoliday: false,
      isPublicHoliday,
      publicHolidayName: pubName,
      slots,
      openTime: formatHm(ranges[0]!.startMin),
      closeTime: formatHm(ranges[ranges.length - 1]!.endMin),
    })
  }

  return result
})
