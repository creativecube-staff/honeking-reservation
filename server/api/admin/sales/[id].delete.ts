import { Prisma } from '@prisma/client'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'

// 販売取り消し。
// 物販: 在庫を戻す。
// 回数券: 既に消費されていたら取り消し不可。未消費なら CustomerVoucher も削除。
// 物理削除。誤登録の即時訂正用。
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sale:edit')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const sale = await prisma.productSale.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, kind: true } },
      voucher: { select: { id: true, totalUses: true, remainingUses: true, usages: { select: { id: true } } } },
    },
  })
  if (!sale) {
    throw createError({ statusCode: 404, statusMessage: '販売記録が見つかりません' })
  }

  // 回数券で消費済みなら取り消し不可
  if (sale.product.kind === 'VOUCHER' && sale.voucher) {
    if (sale.voucher.usages.length > 0) {
      throw createError({ statusCode: 409, statusMessage: 'この回数券は既に消費されています。取り消しできません' })
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (sale.product.kind === 'PRODUCT') {
        await tx.product.update({ where: { id: sale.product.id }, data: { stock: { increment: sale.quantity } } })
      }
      if (sale.product.kind === 'VOUCHER' && sale.voucher) {
        await tx.customerVoucher.delete({ where: { id: sale.voucher.id } })
      }
      await tx.productSale.delete({ where: { id } })
      return { ok: true }
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: '販売記録が見つかりません' })
    }
    throw e
  }
})
