import { Prisma } from '@prisma/client'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'
import { resolveStoreScope } from '../../../utils/storeScope'

// スタッフを無効化（論理削除）。Staff と Login は別物なので、ログイン中ユーザー自身であっても
// このスタッフ自体は触れる（同一人物判定はそもそも持たない）。
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'staff:edit')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const existing = await prisma.staff.findUnique({ where: { id }, select: { storeId: true } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'スタッフが見つかりません' })
  }
  await resolveStoreScope(event, existing.storeId)

  try {
    return await prisma.staff.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'スタッフが見つかりません' })
    }
    throw e
  }
})
