import { resolveStoreScope } from '../../../../../utils/storeScope'
import { prisma } from '../../../../../utils/prisma'

// 1 店舗の店休日(Holiday)を返す
// クエリ: ?year=YYYY で年絞り（省略時は全件）
// 戻り値: [{ id, date: 'YYYY-MM-DD', note }]
// アクセス権: 店舗スコープに従う（OWNER は全店、他は自店のみ）
export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な店舗 ID です' })
  }

  // 越権 → 403
  await resolveStoreScope(event, storeId)

  const query = getQuery(event)
  const yearRaw = typeof query.year === 'string' ? Number(query.year) : null
  const yearFilter = (Number.isInteger(yearRaw) && yearRaw! >= 1900 && yearRaw! <= 9999) ? yearRaw : null

  const dateWhere = yearFilter
    ? {
        gte: new Date(`${yearFilter}-01-01`),
        lte: new Date(`${yearFilter}-12-31`),
      }
    : undefined

  const rows = await prisma.holiday.findMany({
    where: {
      storeId,
      ...(dateWhere ? { date: dateWhere } : {}),
    },
    orderBy: { date: 'asc' },
    select: { id: true, date: true, note: true },
  })

  // Date → 'YYYY-MM-DD' 文字列に正規化（クライアント側で比較しやすく）
  return rows.map(r => ({
    id: r.id,
    date: r.date.toISOString().slice(0, 10),
    note: r.note,
  }))
})
