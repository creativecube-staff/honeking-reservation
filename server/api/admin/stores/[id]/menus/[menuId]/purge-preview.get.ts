import { requireUser } from '~~/server/utils/requirePermission'
import { buildMenuPurgeReasons, countMenuReservations, loadMenuForPurge } from '~~/server/utils/menuPurge'

// 店舗特別メニューの完全削除プレビュー。共通メニュー版と同じく OWNER のみ。
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ実行できます' })
  }

  const storeId = Number(getRouterParam(event, 'id'))
  const menuId = Number(getRouterParam(event, 'menuId'))
  if (!Number.isInteger(storeId) || storeId <= 0 || !Number.isInteger(menuId) || menuId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  // この店舗の特別メニュー = storeId 一致
  const menu = await loadMenuForPurge({ id: menuId, storeId })
  if (!menu) {
    throw createError({ statusCode: 404, statusMessage: 'メニューが見つかりません' })
  }

  const reservations = await countMenuReservations(menuId)
  const reasons = buildMenuPurgeReasons(menu, reservations)

  return {
    menu,
    counts: { reservations },
    canPurge: reasons.length === 0,
    reasons,
  }
})
