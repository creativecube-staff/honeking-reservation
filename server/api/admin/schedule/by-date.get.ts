import { prisma } from '../../../utils/prisma'

// 指定日の各店舗の営業状況をまとめて返す。
// シフト管理画面で「その日の営業時間 / 店休日」を可視化するためのヘルパー API。
//
// 優先順位:
//   1. Holiday に該当する日 → 店休 (営業しない)
//   2. PublicHoliday に該当する日 → BusinessHour[dayOfWeek=0] (日曜扱い) を引く
//   3. それ以外 → BusinessHour[dayOfWeek=date.getDay()] を引く
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
  const effectiveDow = isPublicHoliday ? 0 : dayOfWeek
  const holidayByStore = new Map(holidays.map(h => [h.storeId, h]))

  return stores.map((s) => {
    const holiday = holidayByStore.get(s.id) ?? null
    const bh = businessHours.find(b => b.storeId === s.id && b.dayOfWeek === effectiveDow) ?? null

    return {
      store: s,
      date,
      dayOfWeek: effectiveDow,
      isHoliday: !!holiday,
      holidayNote: holiday?.note ?? null,
      isPublicHoliday,
      publicHolidayName: publicHoliday?.name ?? null,
      // BusinessHour ベースの営業時間 (Holiday の場合は意味がないが参考までに返す)
      isClosed: bh?.isClosed ?? false,
      openTime: bh?.openTime ?? null,
      closeTime: bh?.closeTime ?? null,
      breakStartTime: bh?.breakStartTime ?? null,
      breakEndTime: bh?.breakEndTime ?? null,
    }
  })
})
