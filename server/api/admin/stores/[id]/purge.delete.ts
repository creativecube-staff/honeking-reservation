import { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'
import { computeStoreBlastRadius, purgeStore } from '~~/server/utils/storePurge'

// 店舗の完全削除（物理削除・不可逆）。OWNER のみ。
// 安全ガード:
//  - 確認用に body.confirmName へ店舗名の完全一致を要求（誤爆防止）
//  - 無効化済み(isActive=false)の店舗のみ（有効な店舗は無効化を先に）
//  - この店舗のスタッフが他店の予約を担当している場合は拒否（他店データ巻き込み防止）
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ実行できます' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const store = await prisma.store.findUnique({ where: { id } })
  if (!store) {
    throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })
  }

  const body = await readBody(event).catch(() => null)
  const confirmName = body && typeof body.confirmName === 'string' ? body.confirmName : ''
  if (confirmName !== store.name) {
    throw createError({ statusCode: 400, statusMessage: '確認のため店舗名を正しく入力してください' })
  }

  if (store.isActive) {
    throw createError({ statusCode: 409, statusMessage: '有効な店舗は完全削除できません。先に無効化してください。' })
  }

  const blast = await computeStoreBlastRadius(id)
  if (blast.crossStoreReservations > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `この店舗のスタッフが他店の予約を ${blast.crossStoreReservations} 件担当しているため完全削除できません。`,
    })
  }

  try {
    await purgeStore(id)
  }
  catch (e) {
    // 想定外の FK 残り（他店から参照される店舗特別メニュー/商品など）はトランザクションがロールバック済み。
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw createError({ statusCode: 409, statusMessage: '他のデータから参照されているため削除できませんでした。先に関連データを整理してください。' })
    }
    throw e
  }

  return { ok: true, storeName: store.name, deleted: blast.counts }
})
