import { Prisma } from '@prisma/client'
import { prisma } from '../../../../../utils/prisma'

// 論理削除: isActive=false。物理削除は予約 FK で onDelete: Restrict のためどうせ通らない。
export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  const bedId = Number(getRouterParam(event, 'bedId'))
  if (!Number.isInteger(storeId) || storeId <= 0 || !Number.isInteger(bedId) || bedId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const bed = await prisma.bed.findFirst({ where: { id: bedId, storeId }, select: { id: true } })
  if (!bed) {
    throw createError({ statusCode: 404, statusMessage: 'ベッドが見つかりません' })
  }

  try {
    return await prisma.bed.update({ where: { id: bedId }, data: { isActive: false } })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'ベッドが見つかりません' })
    }
    throw e
  }
})
