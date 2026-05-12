import { prisma } from '../../../utils/prisma'

// シフト一覧。
// - ?date=YYYY-MM-DD: 単日（既存挙動）
// - ?month=YYYY-MM: 月単位（その月の 1 日 〜 末日のシフトをまとめて返す）
// - ?from=YYYY-MM-DD&to=YYYY-MM-DD: 任意の日付範囲（週ビュー用、from <= date <= to）
// - ?storeId: メイン店舗または workStore が一致するシフトに絞り込み（任意）
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const date = typeof query.date === 'string' ? query.date : ''
  const month = typeof query.month === 'string' ? query.month : ''
  const from = typeof query.from === 'string' ? query.from : ''
  const to = typeof query.to === 'string' ? query.to : ''

  let dateFilter: { date: Date } | { date: { gte: Date, lt: Date } } | { date: { gte: Date, lte: Date } }

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    dateFilter = { date: new Date(date) }
  }
  else if (/^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number)
    const start = new Date(y!, m! - 1, 1)
    const end = new Date(y!, m!, 1) // 翌月 1 日
    dateFilter = { date: { gte: start, lt: end } }
  }
  else if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    dateFilter = { date: { gte: new Date(from), lte: new Date(to) } }
  }
  else {
    throw createError({
      statusCode: 400,
      statusMessage: 'date (YYYY-MM-DD) / month (YYYY-MM) / from+to (YYYY-MM-DD) のいずれかを指定してください',
    })
  }

  const storeIdRaw = typeof query.storeId === 'string' ? Number(query.storeId) : null
  const storeId = Number.isInteger(storeIdRaw) && storeIdRaw && storeIdRaw > 0 ? storeIdRaw : null

  const where = storeId
    ? {
        ...dateFilter,
        OR: [
          { workStoreId: storeId },
          { workStoreId: null, practitioner: { storeId } },
        ],
      }
    : dateFilter

  return prisma.shift.findMany({
    where,
    orderBy: [
      { date: 'asc' },
      { practitioner: { storeId: 'asc' } },
      { practitioner: { displayOrder: 'asc' } },
    ],
    include: {
      practitioner: {
        include: { store: { select: { id: true, name: true } } },
      },
      workStore: { select: { id: true, name: true } },
    },
  })
})
