import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'

// 国民の祝日（全店共通）の一覧を返す。
// クエリ: ?year=2026 で年で絞る（省略時は全件、日付昇順）。
//
// 閲覧は管理画面にログイン中の全ユーザーに開放（カレンダー表示で使うため。データ自体は機密性なし）。
// 編集系は別エンドポイントで OWNER 制限する想定。
export default defineEventHandler(async (event) => {
  await requireUser(event)

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
