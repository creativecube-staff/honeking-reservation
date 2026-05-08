import { Prisma } from '@prisma/client'
import { createClosureSchema } from '../../../../../../shared/schemas/closure'
import { prisma } from '../../../../../utils/prisma'

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
  const parsed = createClosureSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  // 同日に既存の部分閉店レンジと重複していないか確認
  const sameDay = await prisma.closure.findMany({
    where: { storeId, date: new Date(parsed.data.date) },
    select: { startTime: true, endTime: true },
  })
  for (const r of sameDay) {
    if (r.startTime < parsed.data.endTime && parsed.data.startTime < r.endTime) {
      throw createError({
        statusCode: 409,
        statusMessage: `同じ日に既存の部分閉店レンジ ${r.startTime}-${r.endTime} と重複しています`,
      })
    }
  }

  try {
    return await prisma.closure.create({
      data: {
        storeId,
        date: new Date(parsed.data.date),
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        note: parsed.data.note ?? null,
      },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'その日付・開始時刻はすでに登録されています' })
    }
    throw e
  }
})
