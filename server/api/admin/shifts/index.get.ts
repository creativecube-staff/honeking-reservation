import { prisma } from '../../../utils/prisma'

// 指定日のシフト一覧。?date=YYYY-MM-DD 必須。
// 任意で ?storeId フィルタ（メイン店舗 or workStore のどちらかが一致するシフト）
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const date = typeof query.date === 'string' ? query.date : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, statusMessage: 'date は YYYY-MM-DD 形式で指定してください' })
  }

  const storeIdRaw = typeof query.storeId === 'string' ? Number(query.storeId) : null
  const storeId = Number.isInteger(storeIdRaw) && storeIdRaw && storeIdRaw > 0 ? storeIdRaw : null

  const where = storeId
    ? {
        date: new Date(date),
        OR: [
          { workStoreId: storeId },
          { workStoreId: null, practitioner: { storeId } },
        ],
      }
    : { date: new Date(date) }

  return prisma.shift.findMany({
    where,
    orderBy: [
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
