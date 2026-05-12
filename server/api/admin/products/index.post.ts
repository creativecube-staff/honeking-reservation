import { Prisma } from '@prisma/client'
import { createProductSchema } from '../../../../shared/schemas/product'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'product:edit')

  const body = await readBody(event)
  const parsed = createProductSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  const { description, ...rest } = parsed.data
  // VOUCHER は在庫概念なし → stock 強制 0
  if (rest.kind === 'VOUCHER') rest.stock = 0
  // PRODUCT は voucherTotalUses を持たない
  const voucherTotalUses = rest.kind === 'VOUCHER' ? rest.voucherTotalUses ?? null : null

  try {
    return await prisma.product.create({
      data: {
        ...rest,
        voucherTotalUses,
        description: description || null,
      },
      include: { store: { select: { id: true, name: true } } },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: '同じ店舗内に同じ商品名が既に存在します' })
    }
    throw e
  }
})
