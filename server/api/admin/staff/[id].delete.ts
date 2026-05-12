import { Prisma } from '@prisma/client'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'

export default defineEventHandler(async (event) => {
  const currentUser = await requirePermission(event, 'staff:edit')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }
  if (id === currentUser.id) {
    throw createError({ statusCode: 400, statusMessage: '自分自身を無効化することはできません' })
  }

  try {
    return await prisma.practitioner.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'スタッフが見つかりません' })
    }
    throw e
  }
})
