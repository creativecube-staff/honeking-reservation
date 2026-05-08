import { Prisma } from '@prisma/client'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  const closureId = Number(getRouterParam(event, 'closureId'))
  if (!Number.isInteger(storeId) || storeId <= 0 || !Number.isInteger(closureId) || closureId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const closure = await prisma.closure.findFirst({
    where: { id: closureId, storeId },
    select: { id: true },
  })
  if (!closure) {
    throw createError({ statusCode: 404, statusMessage: '部分閉店が見つかりません' })
  }

  try {
    return await prisma.closure.delete({ where: { id: closureId } })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: '部分閉店が見つかりません' })
    }
    throw e
  }
})
