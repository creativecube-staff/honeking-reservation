import { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'
import { countMenuReservations, loadMenuForPurge } from '~~/server/utils/menuPurge'

// 共通メニューの完全削除（物理削除・不可逆）。OWNER のみ。
// 安全ガード:
//  - body.confirmName へメニュー名の完全一致を要求（誤爆防止）
//  - 無効化済み（isActive=false）のみ。有効なメニューは先に無効化を
//  - このメニューを参照する予約が 0 件のときだけ（履歴保護）
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ実行できます' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const menu = await loadMenuForPurge({ id, storeId: null })
  if (!menu) {
    throw createError({ statusCode: 404, statusMessage: '共通メニューが見つかりません' })
  }

  const body = await readBody(event).catch(() => null)
  const confirmName = body && typeof body.confirmName === 'string' ? body.confirmName : ''
  if (confirmName !== menu.name) {
    throw createError({ statusCode: 400, statusMessage: '確認のためメニュー名を正しく入力してください' })
  }

  if (menu.isActive) {
    throw createError({ statusCode: 409, statusMessage: '有効なメニューは完全削除できません。先に無効化してください。' })
  }

  const reservations = await countMenuReservations(id)
  if (reservations > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `このメニューを使った予約が ${reservations} 件あるため完全削除できません。`,
    })
  }

  try {
    // FK Restrict 対応: 先に関連参照を消してからメニュー本体を消す（同一トランザクション）。
    //  - MenuStoreExclusion: この共通メニューの「非表示店舗」設定
    //  - 差し替え参照(replacesMenuId = id)を持つ店舗特別メニューを null に戻す（その特別メニュー自体は残す）
    await prisma.$transaction(async (tx) => {
      await tx.menuStoreExclusion.deleteMany({ where: { menuId: id } })
      await tx.menu.updateMany({ where: { replacesMenuId: id }, data: { replacesMenuId: null } })
      await tx.menu.delete({ where: { id } })
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
