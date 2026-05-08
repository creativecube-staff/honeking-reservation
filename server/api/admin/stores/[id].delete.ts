import { Prisma } from '@prisma/client'
import { prisma } from '../../../utils/prisma'

// 論理削除: isActive=false にする（物理削除はしない）
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  try {
    return await prisma.store.update({
      where: { id },
      data: { isActive: false },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })
    }
    throw e
  }
})
