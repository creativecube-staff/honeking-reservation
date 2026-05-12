import { Prisma } from '@prisma/client'
import { prisma } from '../../../../utils/prisma'
import { requirePermission } from '../../../../utils/requirePermission'

// 予約への回数券消費を取り消す（残回数を戻す）。
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sale:edit')

  const reservationId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const usage = await prisma.voucherUsage.findUnique({
    where: { reservationId },
    select: { id: true, customerVoucherId: true },
  })
  if (!usage) {
    throw createError({ statusCode: 404, statusMessage: '回数券消費が見つかりません' })
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.voucherUsage.delete({ where: { id: usage.id } })
      await tx.customerVoucher.update({
        where: { id: usage.customerVoucherId },
        data: { remainingUses: { increment: 1 } },
      })
    })
    return { ok: true }
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: '回数券消費が見つかりません' })
    }
    throw e
  }
})
