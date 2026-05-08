import { businessHoursBulkSchema } from '../../../../../../shared/schemas/businessHour'
import { prisma } from '../../../../../utils/prisma'

// 7 曜日分まとめて upsert
export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な店舗 ID です' })
  }

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true } })
  if (!store) {
    throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })
  }

  const body = await readBody(event)
  const parsed = businessHoursBulkSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  // dayOfWeek が 0..6 でちょうど 1 件ずつあること（重複なし）
  const seen = new Set<number>()
  for (const h of parsed.data.hours) {
    if (seen.has(h.dayOfWeek)) {
      throw createError({ statusCode: 400, statusMessage: '同じ曜日が重複しています' })
    }
    seen.add(h.dayOfWeek)
  }

  // 7 件をトランザクションで upsert
  await prisma.$transaction(
    parsed.data.hours.map(h =>
      prisma.businessHour.upsert({
        where: { storeId_dayOfWeek: { storeId, dayOfWeek: h.dayOfWeek } },
        create: {
          storeId,
          dayOfWeek: h.dayOfWeek,
          isClosed: h.isClosed,
          openTime: h.isClosed ? null : h.openTime,
          closeTime: h.isClosed ? null : h.closeTime,
          breakStartTime: h.isClosed ? null : h.breakStartTime,
          breakEndTime: h.isClosed ? null : h.breakEndTime,
        },
        update: {
          isClosed: h.isClosed,
          openTime: h.isClosed ? null : h.openTime,
          closeTime: h.isClosed ? null : h.closeTime,
          breakStartTime: h.isClosed ? null : h.breakStartTime,
          breakEndTime: h.isClosed ? null : h.breakEndTime,
        },
      }),
    ),
  )

  return { ok: true, count: parsed.data.hours.length }
})
