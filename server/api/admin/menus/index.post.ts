import { Prisma } from '@prisma/client'
import { createMenuSchema } from '../../../../shared/schemas/menu'
import { prisma } from '../../../utils/prisma'

// 共通メニューを作成（storeId は強制的に null）
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = createMenuSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  const { availableFrom, availableUntil, ...rest } = parsed.data

  try {
    return await prisma.menu.create({
      data: {
        ...rest,
        storeId: null,
        availableFrom: availableFrom == null ? null : new Date(availableFrom),
        availableUntil: availableUntil == null ? null : new Date(availableUntil),
      },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: '同名の共通メニューがすでに存在します' })
    }
    throw e
  }
})
