import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'

// 国民の祝日（全店共通）の一覧を返す。
// クエリ: ?year=2026 で年で絞る（省略時は全件、日付昇順）。
//
// 閲覧は OWNER のみ。管理者モード専用ページから呼ばれる前提。
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ閲覧できます' })
  }

  const query = getQuery(event)
  const yearRaw = typeof query.year === 'string' ? Number(query.year) : null
  const yearFilter = (Number.isInteger(yearRaw) && yearRaw! >= 1900 && yearRaw! <= 9999) ? yearRaw : null

  const where = yearFilter
    ? {
        date: {
          gte: new Date(`${yearFilter}-01-01`),
          lte: new Date(`${yearFilter}-12-31`),
        },
      }
    : {}

  return prisma.publicHoliday.findMany({
    where,
    orderBy: { date: 'asc' },
  })
})
