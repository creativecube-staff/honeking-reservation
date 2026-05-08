import { Prisma } from '@prisma/client'
import { upsertShiftSchema } from '../../../../shared/schemas/shift'
import { prisma } from '../../../utils/prisma'

// シフトの新規作成 or 上書き（practitionerId × date unique）。
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = upsertShiftSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  const { practitionerId, date, startTime, endTime, workStoreId } = parsed.data

  // 指定スタッフが存在することを確認
  const staff = await prisma.practitioner.findUnique({
    where: { id: practitionerId },
    select: { id: true },
  })
  if (!staff) {
    throw createError({ statusCode: 400, statusMessage: '指定されたスタッフが見つかりません' })
  }

  // workStoreId 指定時、その店舗が存在することを確認
  if (workStoreId != null) {
    const store = await prisma.store.findUnique({
      where: { id: workStoreId },
      select: { id: true },
    })
    if (!store) {
      throw createError({ statusCode: 400, statusMessage: '指定されたヘルプ先店舗が見つかりません' })
    }
  }

  try {
    return await prisma.shift.upsert({
      where: { practitionerId_date: { practitionerId, date: new Date(date) } },
      create: {
        practitionerId,
        date: new Date(date),
        startTime,
        endTime,
        workStoreId: workStoreId ?? null,
      },
      update: {
        startTime,
        endTime,
        workStoreId: workStoreId ?? null,
      },
      include: {
        practitioner: { include: { store: { select: { id: true, name: true } } } },
        workStore: { select: { id: true, name: true } },
      },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw createError({ statusCode: 400, statusMessage: '関連するレコードが見つかりません' })
    }
    throw e
  }
})
