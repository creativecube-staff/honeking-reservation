import { Prisma } from '@prisma/client'
import { createStaffSchema } from '../../../../shared/schemas/staff'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = createStaffSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  // 指定された店舗が存在することを確認
  const store = await prisma.store.findUnique({
    where: { id: parsed.data.storeId },
    select: { id: true },
  })
  if (!store) {
    throw createError({ statusCode: 400, statusMessage: '指定された店舗が見つかりません' })
  }

  try {
    return await prisma.practitioner.create({ data: parsed.data })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw createError({ statusCode: 400, statusMessage: '指定された店舗が見つかりません' })
    }
    throw e
  }
})
