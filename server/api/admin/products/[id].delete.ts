import { Prisma } from '@prisma/client'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'

// 商品の論理削除（isActive=false）。販売履歴を残すため物理削除はしない。
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'product:edit')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  try {
    return await prisma.product.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: '商品が見つかりません' })
    }
    throw e
  }
})
