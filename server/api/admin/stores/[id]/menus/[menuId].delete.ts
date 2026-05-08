import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  const menuId = Number(getRouterParam(event, 'menuId'))
  if (!Number.isInteger(storeId) || storeId <= 0 || !Number.isInteger(menuId) || menuId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const menu = await prisma.menu.findFirst({ where: { id: menuId, storeId }, select: { id: true } })
  if (!menu) {
    throw createError({ statusCode: 404, statusMessage: 'メニューが見つかりません' })
  }

  // 論理削除（予約 FK が onDelete: Restrict のため物理削除はそもそも通らない）
  return prisma.menu.update({ where: { id: menuId }, data: { isActive: false } })
})
