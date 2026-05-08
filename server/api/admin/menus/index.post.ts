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

  try {
    return await prisma.menu.create({ data: { ...parsed.data, storeId: null } })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: '同名の共通メニューがすでに存在します' })
    }
    throw e
  }
})
