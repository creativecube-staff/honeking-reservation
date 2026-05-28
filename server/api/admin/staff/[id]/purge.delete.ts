import { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'
import { requirePermission } from '~~/server/utils/requirePermission'
import { resolveStoreScope } from '~~/server/utils/storeScope'
import {
  countStaffReservations,
  loadStaffForPurge,
} from '~~/server/utils/staffPurge'

// スタッフの完全削除（物理削除・不可逆）。
// 安全ガード:
//  - body.confirmName へスタッフ名の完全一致を要求（誤爆防止）
//  - 無効化済み（isActive=false）のみ
//  - このスタッフが担当する予約が 0 件のときだけ
//  - 店舗スコープ（OWNER 以外は自店スタッフのみ）
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

  const body = await readBody(event).catch(() => null)
  const confirmName = body && typeof body.confirmName === 'string' ? body.confirmName : ''
  if (confirmName !== staff.name) {
    throw createError({ statusCode: 400, statusMessage: '確認のためスタッフ名を正しく入力してください' })
  }

  if (staff.isActive) {
    throw createError({ statusCode: 409, statusMessage: '有効なスタッフは完全削除できません。先に無効化してください。' })
  }

  const reservations = await countStaffReservations(id)
  if (reservations > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `このスタッフが担当した予約が ${reservations} 件あるため完全削除できません。`,
    })
  }

  try {
    await prisma.staff.delete({ where: { id } })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw createError({ statusCode: 409, statusMessage: '他のデータから参照されているため削除できませんでした。' })
    }
    throw e
  }

  return { ok: true, staffName: staff.name }
})
