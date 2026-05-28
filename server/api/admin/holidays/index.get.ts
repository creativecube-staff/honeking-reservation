import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'

// 全店共通の店休日一覧。
// 運用ルール: Holiday は店舗ごとのテーブルだが、UI では「全店共通」として扱う。
//   - 全店舗（有効なもの）すべてに登録されている日付のみを「店休日」として返す
//   - メモは全店で同一なら採用、ばらつきがあれば先頭のものを返す（基本的に同一前提）
//   - 一部店舗にしか無い行（≒ 過去の店舗別運用の残り）は無視する
//
// クエリ: ?year=2026 で年で絞る（省略時は全件）。
// 戻り値: [{ date: 'YYYY-MM-DD', note: string | null }]
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ閲覧できます' })
  }

  const query = getQuery(event)
  const yearRaw = typeof query.year === 'string' ? Number(query.year) : null
  const yearFilter = (Number.isInteger(yearRaw) && yearRaw! >= 1900 && yearRaw! <= 9999) ? yearRaw : null

  // 有効な店舗の総数（この件数だけ揃っている日付を「全店共通」と判定する）
  const activeStores = await prisma.store.findMany({
    where: { isActive: true },
    select: { id: true },
  })
  const storeCount = activeStores.length

  if (storeCount === 0) return []

  const dateWhere = yearFilter
    ? {
        gte: new Date(`${yearFilter}-01-01`),
        lte: new Date(`${yearFilter}-12-31`),
      }
    : undefined

  const holidays = await prisma.holiday.findMany({
    where: {
      storeId: { in: activeStores.map(s => s.id) },
      ...(dateWhere ? { date: dateWhere } : {}),
    },
    orderBy: { date: 'asc' },
    select: { date: true, note: true, storeId: true },
  })

  // date 文字列でグルーピング
  const byDate = new Map<string, { date: Date, notes: (string | null)[], storeIds: Set<number> }>()
  for (const h of holidays) {
    const key = h.date.toISOString().slice(0, 10)
    if (!byDate.has(key)) byDate.set(key, { date: h.date, notes: [], storeIds: new Set() })
    const entry = byDate.get(key)!
    entry.notes.push(h.note)
    entry.storeIds.add(h.storeId)
  }

  // 全店揃っている日付だけ採用
  const result: { date: string, note: string | null }[] = []
  for (const [key, entry] of byDate) {
    if (entry.storeIds.size !== storeCount) continue
    // メモは最初に見つかった非 null 値、無ければ null
    const note = entry.notes.find(n => n != null) ?? null
    result.push({ date: key, note })
  }
  result.sort((a, b) => a.date.localeCompare(b.date))
  return result
})
