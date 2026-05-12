import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'product:view')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: { store: { select: { id: true, name: true, slug: true } } },
  })
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: '商品が見つかりません' })
  }
  return product
})
