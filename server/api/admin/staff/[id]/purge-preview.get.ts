import { prisma } from '~~/server/utils/prisma'
import { requirePermission } from '~~/server/utils/requirePermission'
import { resolveStoreScope } from '~~/server/utils/storeScope'
import {
  buildStaffPurgeReasons,
  countStaffReservations,
  loadStaffForPurge,
} from '~~/server/utils/staffPurge'

// スタッフの完全削除（物理削除）の影響範囲プレビュー。
// 消える件数と、削除可否(canPurge)・拒否理由を返す。実削除は purge.delete.ts。
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'staff:edit')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const existing = await prisma.staff.findUnique({
    where: { id },
    select: { storeId: true },
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'スタッフが見つかりません' })
  }
  await resolveStoreScope(event, existing.storeId)

  const staff = await loadStaffForPurge({ id, storeId: existing.storeId })
  if (!staff) {
    throw createError({ statusCode: 404, statusMessage: 'スタッフが見つかりません' })
  }

  const reservations = await countStaffReservations(id)
  const reasons = buildStaffPurgeReasons(staff, reservations)

  return {
    staff,
    counts: { reservations },
    canPurge: reasons.length === 0,
    reasons,
  }
})
