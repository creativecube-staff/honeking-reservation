import { Prisma } from '@prisma/client'
import { stockAdjustSchema } from '../../../../../shared/schemas/product'
import { prisma } from '../../../../utils/prisma'
import { requirePermission } from '../../../../utils/requirePermission'

// 在庫調整（+N / -N）。PRODUCT のみ対象。VOUCHER は在庫概念なし。
// 結果在庫がマイナスになる場合はエラー。
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'product:edit')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const body = await readBody(event)
  const parsed = stockAdjustSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, kind: true, stock: true } })
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: '商品が見つかりません' })
  }
  if (product.kind !== 'PRODUCT') {
    throw createError({ statusCode: 400, statusMessage: '回数券は在庫管理の対象外です' })
  }

  const newStock = product.stock + parsed.data.delta
  if (newStock < 0) {
    throw createError({ statusCode: 400, statusMessage: '在庫が不足しています' })
  }

  try {
    return await prisma.product.update({
      where: { id },
      data: { stock: newStock },
      select: { id: true, name: true, stock: true },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: '商品が見つかりません' })
    }
    throw e
  }
})
