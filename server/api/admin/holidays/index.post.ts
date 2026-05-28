import { createHolidaySchema } from '~~/shared/schemas/holiday'
import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'

// 全店一括で店休日を追加する。OWNER のみ。
// 冪等動作: すでに登録済みの店舗はスキップし、未登録の店舗だけ追加する。
// 全店に同じ日付・同じメモで作成し、UI 上は「全店共通」の店休日として扱う。
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ実行できます' })
  }

  const body = await readBody(event)
  const parsed = createHolidaySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  const activeStores = await prisma.store.findMany({
    where: { isActive: true },
    select: { id: true },
  })
  if (activeStores.length === 0) {
    throw createError({ statusCode: 409, statusMessage: '有効な店舗がありません' })
  }

  const date = new Date(parsed.data.date)
  const note = parsed.data.note ?? null

  // createMany + skipDuplicates で既存行は無視（(storeId, date) は @@unique）
  const r = await prisma.holiday.createMany({
    data: activeStores.map(s => ({ storeId: s.id, date, note })),
    skipDuplicates: true,
  })

  return { ok: true, created: r.count, totalStores: activeStores.length }
})
