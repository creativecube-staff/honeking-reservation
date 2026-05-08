import { Prisma } from '@prisma/client'
import { createMenuSchema } from '../../../../../../shared/schemas/menu'
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
        storeId,
        availableFrom: availableFrom == null ? null : new Date(availableFrom),
        availableUntil: availableUntil == null ? null : new Date(availableUntil),
      },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: '同名のメニューがすでに存在します' })
    }
    throw e
  }
})
