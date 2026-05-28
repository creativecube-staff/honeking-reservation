import { z } from 'zod'
import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'

// 全店共通の店休日を編集する。OWNER のみ。
// パス: /api/admin/holidays/2026-12-30
// body: { date?: 'YYYY-MM-DD', note?: string | null }
//
// 動作:
//   - date を変更する場合: 旧日付の Holiday を全店から削除 → 新日付に全店ぶん作成（note は新 note または旧 note を継承）
//   - note のみの場合: 旧日付の全店行の note を一括更新
//
// 既存行が無い日付を指定された場合は 404、新日付に既存行があった場合は 409。
const dateRegex = /^\d{4}-\d{2}-\d{2}$/
const bodySchema = z.object({
  date: z.string().regex(dateRegex, '日付は YYYY-MM-DD 形式で指定してください').optional(),
  note: z.string().max(200, '200 文字以内で入力してください').nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ実行できます' })
  }

  const oldDateParam = getRouterParam(event, 'date')
  if (!oldDateParam || !dateRegex.test(oldDateParam)) {
    throw createError({ statusCode: 400, statusMessage: '日付は YYYY-MM-DD 形式で指定してください' })
  }
  const oldDate = new Date(oldDateParam)

  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  // 旧日付の既存行（全店共通として登録されている前提）
  const existing = await prisma.holiday.findMany({
    where: { date: oldDate },
    select: { id: true, storeId: true, note: true },
  })
  if (existing.length === 0) {
    throw createError({ statusCode: 404, statusMessage: '指定日の店休日が見つかりません' })
  }

  const newDateStr = parsed.data.date
  const isDateChanged = newDateStr && newDateStr !== oldDateParam

  if (isDateChanged) {
    const newDate = new Date(newDateStr!)
    // 新日付に他の Holiday があれば 409（被って一斉作成が落ちる前にガード）
    const conflict = await prisma.holiday.count({ where: { date: newDate } })
    if (conflict > 0) {
      throw createError({ statusCode: 409, statusMessage: 'その日付の店休日はすでに登録されています' })
    }
    // note の決定（指定があればそれ、なければ旧データの代表値）
    const note = parsed.data.note !== undefined ? parsed.data.note ?? null : (existing[0]?.note ?? null)
    const storeIds = existing.map(h => h.storeId)
    await prisma.$transaction([
      prisma.holiday.deleteMany({ where: { date: oldDate } }),
      prisma.holiday.createMany({
        data: storeIds.map(storeId => ({ storeId, date: newDate, note })),
        skipDuplicates: true,
      }),
    ])
    return { ok: true, moved: true, deleted: existing.length, created: storeIds.length }
  }

  // 日付変更なし → メモのみ全店一括更新
  if (parsed.data.note !== undefined) {
    const r = await prisma.holiday.updateMany({
      where: { date: oldDate },
      data: { note: parsed.data.note ?? null },
    })
    return { ok: true, updated: r.count }
  }

  return { ok: true, updated: 0 }
})
