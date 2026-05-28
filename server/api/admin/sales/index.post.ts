import { Prisma } from '@prisma/client'
import { createSaleSchema } from '../../../../shared/schemas/sale'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'

// 販売登録（物販 + 回数券）。
// transaction で:
//   - 物販: Product.stock を quantity 分減算（マイナスになるなら 400）
//   - 回数券: CustomerVoucher を quantity 枚分発行（同じ ProductSale に紐付くのは 1 枚のみ想定なので quantity=1 強制）
//   - ProductSale を 1 行作成
export default defineEventHandler(async (event) => {
  const currentUser = await requirePermission(event, 'sale:edit')

  const body = await readBody(event)
  const parsed = createSaleSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }
  const { productId, storeId, customerId, reservationId, quantity, note } = parsed.data

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product || !product.isActive) {
    throw createError({ statusCode: 404, statusMessage: '商品が見つかりません' })
  }
  // 店舗特別商品は指定店舗と一致必須
  if (product.storeId !== null && product.storeId !== storeId) {
    throw createError({ statusCode: 400, statusMessage: 'この商品は指定店舗で販売できません' })
  }
  if (product.kind === 'VOUCHER' && quantity !== 1) {
    throw createError({ statusCode: 400, statusMessage: '回数券は 1 件ずつ販売してください' })
  }
  if (product.kind === 'PRODUCT' && product.stock < quantity) {
    throw createError({ statusCode: 400, statusMessage: '在庫が不足しています' })
  }

  // 顧客・予約の存在チェック
  const [customer, reservation] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } }),
    reservationId ? prisma.reservation.findUnique({ where: { id: reservationId }, select: { id: true, customerId: true, storeId: true } }) : Promise.resolve(null),
  ])
  if (!customer) throw createError({ statusCode: 400, statusMessage: 'お客様が見つかりません' })
  if (reservationId && !reservation) throw createError({ statusCode: 400, statusMessage: '予約が見つかりません' })

  const unitPriceJpyAtSale = product.priceJpy

  try {
    return await prisma.$transaction(async (tx) => {
      // 物販なら在庫減算
      if (product.kind === 'PRODUCT') {
        await tx.product.update({
          where: { id: product.id },
          data: { stock: { decrement: quantity } },
        })
      }

      const sale = await tx.productSale.create({
        data: {
          productId: product.id,
          storeId,
          customerId,
          reservationId: reservationId ?? null,
          quantity,
          unitPriceJpyAtSale,
          soldByLoginId: currentUser.id,
          note: note?.trim() || null,
        },
      })

      // 回数券なら CustomerVoucher を 1 枚発行
      if (product.kind === 'VOUCHER') {
        const totalUses = product.voucherTotalUses ?? 0
        if (totalUses < 1) {
          throw createError({ statusCode: 500, statusMessage: '回数券の利用回数が設定されていません' })
        }
        await tx.customerVoucher.create({
          data: {
            customerId,
            productId: product.id,
            productSaleId: sale.id,
            totalUses,
            remainingUses: totalUses,
          },
        })
      }

      return tx.productSale.findUnique({
        where: { id: sale.id },
        include: {
          product: { select: { id: true, name: true, kind: true, voucherTotalUses: true } },
          voucher: { select: { id: true, totalUses: true, remainingUses: true } },
        },
      })
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw createError({ statusCode: 400, statusMessage: '関連レコードが見つかりません' })
    }
    throw e
  }
})
