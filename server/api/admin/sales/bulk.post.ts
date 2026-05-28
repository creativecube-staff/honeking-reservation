import { Prisma } from '@prisma/client'
import { createBulkSaleSchema } from '../../../../shared/schemas/sale'
import { getOrCreateGuestCustomer } from '../../../utils/guestCustomer'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'

// 物販クイック販売（複数商品・ゲスト購入対応）
// 1 リクエストで複数商品の販売をまとめて記録する。
//
// 利用ケース:
//   - 予約に紐付かない店頭物販（QuickSale フォーム）
//   - お客様が複数商品を一度に購入
//   - ふらっと来た会員ではないお客様（isGuestPurchase=true）
//
// 既存の単一商品 API (sales/index.post.ts) は予約詳細などで引き続き利用。
// こちらは「複数商品 or ゲスト購入」を扱う専用エンドポイント。
//
// すべての商品を 1 トランザクションで処理:
//   - 物販: stock 減算（マイナスになるなら 400 で全ロールバック）
//   - 回数券: CustomerVoucher を発行
//   - ProductSale を商品分作成
export default defineEventHandler(async (event) => {
  const currentUser = await requirePermission(event, 'sale:edit')

  const body = await readBody(event)
  const parsed = createBulkSaleSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }
  const { storeId, customerId: bodyCustomerId, isGuestPurchase, items } = parsed.data

  // 顧客の解決（ゲスト購入なら lazy create、既存顧客なら存在チェック）
  let customerId: number
  if (isGuestPurchase) {
    const guest = await getOrCreateGuestCustomer()
    customerId = guest.id
  }
  else {
    if (bodyCustomerId == null) {
      throw createError({ statusCode: 400, statusMessage: 'お客様が指定されていません' })
    }
    const customer = await prisma.customer.findUnique({
      where: { id: bodyCustomerId },
      select: { id: true },
    })
    if (!customer) throw createError({ statusCode: 400, statusMessage: 'お客様が見つかりません' })
    customerId = customer.id
  }

  // 商品マスタを一括取得（productId が重複していても順序保持のため Map に集約）
  const productIds = Array.from(new Set(items.map(i => i.productId)))
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  })
  const productMap = new Map(products.map(p => [p.id, p]))

  // 各 item の事前検証（トランザクション前に全件チェック）
  // 在庫は productId ごとに合計を出してから比較する（同じ商品を 2 行に分けた場合の救済）
  const stockNeededByProductId = new Map<number, number>()
  for (const item of items) {
    const product = productMap.get(item.productId)
    if (!product || !product.isActive) {
      throw createError({ statusCode: 404, statusMessage: `商品が見つかりません (id: ${item.productId})` })
    }
    if (product.storeId !== null && product.storeId !== storeId) {
      throw createError({ statusCode: 400, statusMessage: `${product.name} は指定店舗で販売できません` })
    }
    if (product.kind === 'VOUCHER' && item.quantity !== 1) {
      throw createError({ statusCode: 400, statusMessage: `回数券「${product.name}」は 1 件ずつ販売してください` })
    }
    if (product.kind === 'PRODUCT') {
      const prev = stockNeededByProductId.get(product.id) ?? 0
      stockNeededByProductId.set(product.id, prev + item.quantity)
    }
  }
  for (const [pid, needed] of stockNeededByProductId) {
    const product = productMap.get(pid)!
    if (product.stock < needed) {
      throw createError({ statusCode: 400, statusMessage: `${product.name} の在庫が不足しています（必要: ${needed} / 在庫: ${product.stock}）` })
    }
  }

  try {
    const saleIds = await prisma.$transaction(async (tx) => {
      const createdIds: number[] = []
      for (const item of items) {
        const product = productMap.get(item.productId)!

        if (product.kind === 'PRODUCT') {
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: item.quantity } },
          })
        }

        const sale = await tx.productSale.create({
          data: {
            productId: product.id,
            storeId,
            customerId,
            reservationId: null,
            quantity: item.quantity,
            unitPriceJpyAtSale: product.priceJpy,
            soldByLoginId: currentUser.id,
            note: item.note?.trim() || null,
          },
        })
        createdIds.push(sale.id)

        if (product.kind === 'VOUCHER') {
          const totalUses = product.voucherTotalUses ?? 0
          if (totalUses < 1) {
            throw createError({ statusCode: 500, statusMessage: `回数券「${product.name}」の利用回数が設定されていません` })
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
      }
      return createdIds
    })

    return { ok: true, saleIds, count: saleIds.length }
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw createError({ statusCode: 400, statusMessage: '関連レコードが見つかりません' })
    }
    throw e
  }
})
