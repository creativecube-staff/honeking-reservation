import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'
import { buildMenuPurgeReasons, countMenuReservations, loadMenuForPurge } from '~~/server/utils/menuPurge'

// 共通メニューの完全削除（物理削除）の影響範囲プレビュー。
// 消える件数と、削除可否(canPurge)・拒否理由を返す。実削除は purge.delete.ts。
// 破壊的操作なので OWNER のみ。
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ実行できます' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  // 共通メニュー = storeId IS NULL
  const menu = await loadMenuForPurge({ id, storeId: null })
  if (!menu) {
    throw createError({ statusCode: 404, statusMessage: '共通メニューが見つかりません' })
  }

  const reservations = await countMenuReservations(id)
  const reasons = buildMenuPurgeReasons(menu, reservations)

  return {
    menu,
    counts: { reservations },
    canPurge: reasons.length === 0,
    reasons,
  }
})
