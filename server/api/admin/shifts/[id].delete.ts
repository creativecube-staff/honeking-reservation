import { Prisma } from '@prisma/client'
import { prisma } from '../../../utils/prisma'

// シフトの物理削除（マスタではなく日次データなので物理削除する）。
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  try {
    return await prisma.shift.delete({ where: { id } })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'シフトが見つかりません' })
    }
    throw e
  }
})
