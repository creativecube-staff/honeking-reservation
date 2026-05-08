import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な店舗 ID です' })
  }

  return prisma.bed.findMany({
    where: { storeId },
    orderBy: [
      { displayOrder: 'asc' },
      { id: 'asc' },
    ],
  })
})
