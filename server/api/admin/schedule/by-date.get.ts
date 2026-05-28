import { DOW_PUBLIC_HOLIDAY, resolveBusinessHourDow } from '~~/shared/businessHours'
import { prisma } from '../../../utils/prisma'

// 指定日の各店舗の営業状況をまとめて返す。
// シフト管理画面で「その日の営業時間 / 店休日」を可視化するためのヘルパー API。
//
// 優先順位:
//   1. Holiday に該当する日 → 店休 (営業しない)
//   2. PublicHoliday に該当する日 → 祝日(-1) レンジを持つ店舗はそれを、無ければ日曜(0)にフォールバック
//   3. それ以外 → BusinessHour[dayOfWeek=date.getDay()] を引く
//
// BusinessHour は 1 日に複数レンジを持てるので ranges として返す。
// 互換のため openTime/closeTime は最早/最遅で導出、breakStartTime/breakEndTime は
// 「最初の中抜け」を表す（中抜けが複数ある場合は最初の 1 つだけ）。
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const date = typeof query.date === 'string' ? query.date : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, statusMessage: 'date は YYYY-MM-DD 形式で指定してください' })
  }

  const target = new Date(date)
  // UTC ベースの曜日 (DB は @db.Date で UTC 0 時として保存されている)
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay()

  const [stores, businessHours, holidays, publicHoliday] = await Promise.all([
    prisma.store.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, slug: true },
    }),
    prisma.businessHour.findMany({}),
    prisma.holiday.findMany({ where: { date: target } }),
    prisma.publicHoliday.findUnique({ where: { date: target } }),
  ])

  const isPublicHoliday = !!publicHoliday
  const holidayByStore = new Map(holidays.map(h => [h.storeId, h]))

  return stores.map((s) => {
    const holiday = holidayByStore.get(s.id) ?? null
    // 店舗ごとに祝日(-1) レンジ有無を判定し、無ければ日曜にフォールバック
    const hasHolidayRanges = businessHours.some(
      b => b.storeId === s.id && b.dayOfWeek === DOW_PUBLIC_HOLIDAY,
    )
    const effectiveDow = resolveBusinessHourDow(isPublicHoliday, dayOfWeek, hasHolidayRanges)
    const ranges = businessHours
      .filter(b => b.storeId === s.id && b.dayOfWeek === effectiveDow)
      .map(b => ({ startTime: b.startTime, endTime: b.endTime }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))

    const isClosed = ranges.length === 0
    const openTime = ranges[0]?.startTime ?? null
    const closeTime = ranges[ranges.length - 1]?.endTime ?? null
    // 最初の中抜け（ranges[0].endTime → ranges[1].startTime）を返す
    const breakStartTime = ranges.length >= 2 ? ranges[0]!.endTime : null
    const breakEndTime = ranges.length >= 2 ? ranges[1]!.startTime : null

    return {
      store: s,
      date,
      // 祝日かつ -1 フォールバックを使う場合は日曜(0) が出るのは仕様どおり
      dayOfWeek: effectiveDow,
      isHoliday: !!holiday,
      holidayNote: holiday?.note ?? null,
      isPublicHoliday,
      publicHolidayName: publicHoliday?.name ?? null,
      isClosed,
      openTime,
      closeTime,
      breakStartTime,
      breakEndTime,
      ranges,
    }
  })
})
