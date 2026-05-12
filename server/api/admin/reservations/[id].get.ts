import { decryptUtf8 } from '../../../utils/crypto'
import { prisma } from '../../../utils/prisma'

// 管理画面: 予約 1 件詳細（顧客情報を復号して返す）
export default defineEventHandler(async (event) => {
  const idRaw = getRouterParam(event, 'id')
  const id = Number(idRaw)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '予約 ID が不正です' })
  }

  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      store: { select: { id: true, name: true, address: true, phone: true } },
      bed: { select: { id: true, name: true } },
      practitioner: { select: { id: true, name: true, storeId: true } },
      menu: { select: { id: true, name: true, durationMinutes: true, priceJpy: true } },
      customer: { select: { id: true, name: true, phone: true, email: true } },
      // 変更履歴（新しい順）
      histories: { orderBy: { changedAt: 'desc' } },
      // この予約に紐付いた物販・回数券販売
      productSales: {
        orderBy: { soldAt: 'asc' },
        include: {
          product: { select: { id: true, name: true, kind: true, voucherTotalUses: true } },
          voucher: { select: { id: true, totalUses: true, remainingUses: true } },
        },
      },
      // 回数券消費（あれば 1 件）。あると売上ゼロ扱い
      voucherUsage: {
        include: {
          customerVoucher: {
            include: { product: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })
  if (!r) {
    throw createError({ statusCode: 404, statusMessage: '予約が見つかりません' })
  }

  const safeDecrypt = (enc: string | null): string | null => {
    if (!enc) return null
    try {
      return decryptUtf8(enc)
    }
    catch {
      return null
    }
  }

  return {
    ...r,
    customer: {
      id: r.customer.id,
      name: safeDecrypt(r.customer.name),
      phone: safeDecrypt(r.customer.phone),
      email: safeDecrypt(r.customer.email),
    },
  }
})
