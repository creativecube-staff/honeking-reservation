import { z } from 'zod'
import { prisma } from '../../../utils/prisma'

// 管理画面: 予約ステータス変更（キャンセル / 完了 / 無断キャンセル）
// CANCELLED 化すると、その枠は再予約可能になる（EXCLUDE 制約は status<>'CANCELLED' で評価）
const patchSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']),
  note: z.string().trim().max(1000).optional(),
})

export default defineEventHandler(async (event) => {
  const idRaw = getRouterParam(event, 'id')
  const id = Number(idRaw)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '予約 ID が不正です' })
  }

  const body = await readBody(event)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  const existing = await prisma.reservation.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '予約が見つかりません' })
  }

  const { status, note } = parsed.data
  const data: { status: typeof status, note?: string, cancelledAt?: Date | null } = { status }
  if (typeof note !== 'undefined') data.note = note
  // キャンセル日時の自動セット
  if (status === 'CANCELLED' && existing.status !== 'CANCELLED') {
    data.cancelledAt = new Date()
  }
  if (status !== 'CANCELLED' && existing.cancelledAt) {
    data.cancelledAt = null
  }

  return prisma.reservation.update({ where: { id }, data })
})
