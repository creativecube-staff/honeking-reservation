import { Prisma } from '@prisma/client'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  try {
    return await prisma.practitioner.update({
      where: { id },
      data: { isActive: false },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'スタッフが見つかりません' })
    }
    throw e
  }
})
