import { decryptUtf8 } from '../../../../utils/crypto'
import { prisma } from '../../../../utils/prisma'
import { requirePermission } from '../../../../utils/requirePermission'

// 管理画面: 顧客詳細（基本情報のみ）
// 予約履歴・販売履歴・回数券は別の既存 API を customerId で絞って取得する。
//   - GET /api/admin/reservations?customerId=...
//   - GET /api/admin/sales?customerId=...
//   - GET /api/admin/customers/:id/vouchers
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'customer:view')

  const customerId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const c = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      passwordHash: true,
      emailVerifiedAt: true,
      withdrawnAt: true,
      lastLoginAt: true,
      termsAgreedAt: true,
      termsVersionAgreedAt: true,
      note: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          reservations: true,
          productSales: true,
          vouchers: true,
        },
      },
    },
  })

  if (!c) {
    throw createError({ statusCode: 404, statusMessage: '顧客が見つかりません' })
  }

  // 予約中（未来の CONFIRMED）件数
  const now = new Date()
  const upcomingCount = await prisma.reservation.count({
    where: {
      customerId,
      status: 'CONFIRMED',
      startAt: { gt: now },
    },
  })

  const safeDecrypt = (enc: string | null): string | null => {
    if (!enc) return null
    try { return decryptUtf8(enc) }
    catch { return null }
  }

  return {
    id: c.id,
    name: safeDecrypt(c.name),
    phone: safeDecrypt(c.phone),
    email: safeDecrypt(c.email),
    membership:
      c.withdrawnAt ? 'withdrawn'
        : c.passwordHash && c.emailVerifiedAt ? 'member'
          : c.passwordHash ? 'pending'
              : 'guest',
    emailVerifiedAt: c.emailVerifiedAt,
    withdrawnAt: c.withdrawnAt,
    lastLoginAt: c.lastLoginAt,
    termsAgreedAt: c.termsAgreedAt,
    termsVersionAgreedAt: c.termsVersionAgreedAt,
    note: c.note,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    counts: {
      reservations: c._count.reservations,
      sales: c._count.productSales,
      vouchers: c._count.vouchers,
      upcoming: upcomingCount,
    },
  }
})
