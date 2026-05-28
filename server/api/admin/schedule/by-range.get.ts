import { DOW_PUBLIC_HOLIDAY, resolveBusinessHourDow } from '~~/shared/businessHours'
import { prisma } from '../../../utils/prisma'

// 日付範囲（最大 31 日）にわたる各店舗の営業状況をまとめて返す。
// 週ビュー（7 日）や任意の範囲をクライアント側で 1 回のリクエストで描画するための API。
//
// 優先順位は by-date.get.ts と同じ:
//   1. Holiday に該当する日 → 店休
//   2. PublicHoliday に該当する日 → 祝日(-1) レンジ優先、無ければ日曜(0) にフォールバック
//   3. それ以外 → BusinessHour[dayOfWeek=date.getDay()]
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const from = typeof query.from === 'string' ? query.from : ''
  const to = typeof query.to === 'string' ? query.to : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw createError({ statusCode: 400, statusMessage: 'from / to は YYYY-MM-DD 形式で指定してください' })
  }

  const fromDate = new Date(`${from}T00:00:00Z`)
  const toDate = new Date(`${to}T00:00:00Z`)
  if (fromDate > toDate) {
    throw createError({ statusCode: 400, statusMessage: 'from は to 以前にしてください' })
  }
  const dayDiff = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000)
  if (dayDiff > 31) {
    throw createError({ statusCode: 400, statusMessage: '日付範囲は 31 日以内にしてください' })
  }

  const [stores, businessHours, holidays, publicHolidays] = await Promise.all([
    prisma.store.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, slug: true },
    }),
    prisma.businessHour.findMany({}),
    prisma.holiday.findMany({ where: { date: { gte: fromDate, lte: toDate } } }),
    prisma.publicHoliday.findMany({ where: { date: { gte: fromDate, lte: toDate } } }),
  ])

  function pad(n: number): string {
    return String(n).padStart(2, '0')
  }
  function ymdOf(d: Date): string {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }

  // (ymd, storeId) → holiday  /  ymd → publicHoliday
  const holidayMap = new Map<string, { storeId: number, note: string | null }>()
  for (const h of holidays) {
    holidayMap.set(`${ymdOf(h.date)}:${h.storeId}`, { storeId: h.storeId, note: h.note ?? null })
  }
  const publicHolidayMap = new Map<string, { name: string }>()
  for (const p of publicHolidays) {
    publicHolidayMap.set(ymdOf(p.date), { name: p.name })
  }

  // 日ごとに各店舗の状況を組み立て
  type DayStoreInfo = {
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
    ranges: { startTime: string, endTime: string }[]
  }

  // 店舗ごとの祝日(-1) レンジ有無（祝日 → 日曜フォールバック判定用）。一度だけ計算。
  const storeHasHolidayRanges = new Map<number, boolean>()
  for (const s of stores) {
    storeHasHolidayRanges.set(
      s.id,
      businessHours.some(b => b.storeId === s.id && b.dayOfWeek === DOW_PUBLIC_HOLIDAY),
    )
  }

  const result: DayStoreInfo[] = []
  for (let i = 0; i <= dayDiff; i++) {
    const d = new Date(fromDate)
    d.setUTCDate(d.getUTCDate() + i)
    const ymd = ymdOf(d)
    const pub = publicHolidayMap.get(ymd) ?? null
    const isPublicHoliday = !!pub
    const baseDow = d.getUTCDay()

    for (const s of stores) {
      const holiday = holidayMap.get(`${ymd}:${s.id}`) ?? null
      const dayOfWeek = resolveBusinessHourDow(
        isPublicHoliday,
        baseDow,
        storeHasHolidayRanges.get(s.id) ?? false,
      )
      const ranges = businessHours
        .filter(b => b.storeId === s.id && b.dayOfWeek === dayOfWeek)
        .map(b => ({ startTime: b.startTime, endTime: b.endTime }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime))

      const isClosed = ranges.length === 0
      const openTime = ranges[0]?.startTime ?? null
      const closeTime = ranges[ranges.length - 1]?.endTime ?? null

      result.push({
        store: s,
        date: ymd,
        dayOfWeek,
        isHoliday: !!holiday,
        holidayNote: holiday?.note ?? null,
        isPublicHoliday,
        publicHolidayName: pub?.name ?? null,
        isClosed,
        openTime,
        closeTime,
        ranges,
      })
    }
  }

  return result
})
