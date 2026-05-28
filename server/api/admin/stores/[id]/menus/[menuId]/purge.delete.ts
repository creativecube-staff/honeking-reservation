import { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'
import { countMenuReservations, loadMenuForPurge } from '~~/server/utils/menuPurge'

// 店舗特別メニューの完全削除（物理削除・不可逆）。共通メニュー版と同じガード + storeId 一致チェック。
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

  const menu = await loadMenuForPurge({ id: menuId, storeId })
  if (!menu) {
    throw createError({ statusCode: 404, statusMessage: 'メニューが見つかりません' })
  }

  const body = await readBody(event).catch(() => null)
  const confirmName = body && typeof body.confirmName === 'string' ? body.confirmName : ''
  if (confirmName !== menu.name) {
    throw createError({ statusCode: 400, statusMessage: '確認のためメニュー名を正しく入力してください' })
  }

  if (menu.isActive) {
    throw createError({ statusCode: 409, statusMessage: '有効なメニューは完全削除できません。先に無効化してください。' })
  }

  const reservations = await countMenuReservations(menuId)
  if (reservations > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `このメニューを使った予約が ${reservations} 件あるため完全削除できません。`,
    })
  }

  try {
    // FK Restrict 対応: 念のため除外行を消してからメニュー本体を消す（店舗特別メニューは設計上除外を持たないが防御的に）
    await prisma.$transaction(async (tx) => {
      await tx.menuStoreExclusion.deleteMany({ where: { menuId } })
      await tx.menu.delete({ where: { id: menuId } })
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw createError({ statusCode: 409, statusMessage: '他のデータから参照されているため削除できませんでした。' })
    }
    throw e
  }

  return { ok: true, menuName: menu.name }
})
