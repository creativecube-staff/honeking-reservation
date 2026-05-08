import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const staff = await prisma.practitioner.findUnique({
    where: { id },
    include: { store: { select: { id: true, name: true, slug: true } } },
  })
  if (!staff) {
    throw createError({ statusCode: 404, statusMessage: 'スタッフが見つかりません' })
  }
  return staff
})
