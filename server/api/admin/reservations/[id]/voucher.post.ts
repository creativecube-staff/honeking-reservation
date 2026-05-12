import { Prisma } from '@prisma/client'
import { useVoucherSchema } from '../../../../../shared/schemas/sale'
import { prisma } from '../../../../utils/prisma'
import { requirePermission } from '../../../../utils/requirePermission'

// 予約に回数券を消費する。
// transaction で:
//   - その予約に既に VoucherUsage があれば 409（1 予約 = 1 消費）
//   - CustomerVoucher の remainingUses をデクリメント（0 なら 400）
//   - VoucherUsage を作成
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sale:edit')

  const reservationId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const body = await readBody(event)
  const parsed = useVoucherSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }
  const { customerVoucherId } = parsed.data

  const [reservation, voucher, existing] = await Promise.all([
    prisma.reservation.findUnique({ where: { id: reservationId }, select: { id: true, customerId: true } }),
    prisma.customerVoucher.findUnique({ where: { id: customerVoucherId }, select: { id: true, customerId: true, remainingUses: true } }),
    prisma.voucherUsage.findUnique({ where: { reservationId } }),
  ])
  if (!reservation) throw createError({ statusCode: 404, statusMessage: '予約が見つかりません' })
  if (!voucher) throw createError({ statusCode: 404, statusMessage: '回数券が見つかりません' })
  if (voucher.customerId !== reservation.customerId) {
    throw createError({ statusCode: 400, statusMessage: 'この回数券はこの予約のお客様のものではありません' })
  }
  if (voucher.remainingUses < 1) {
    throw createError({ statusCode: 400, statusMessage: 'この回数券は残回数がありません' })
  }
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'この予約は既に回数券で消費済みです' })
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.customerVoucher.update({
        where: { id: customerVoucherId },
        data: { remainingUses: { decrement: 1 } },
      })
      return tx.voucherUsage.create({
        data: { customerVoucherId, reservationId },
        include: {
          customerVoucher: {
            include: { product: { select: { id: true, name: true } } },
          },
        },
      })
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        throw createError({ statusCode: 409, statusMessage: 'この予約は既に回数券で消費済みです' })
      }
    }
    throw e
  }
})
