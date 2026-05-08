import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const menu = await prisma.menu.findFirst({ where: { id, storeId: null }, select: { id: true } })
  if (!menu) {
    throw createError({ statusCode: 404, statusMessage: '共通メニューが見つかりません' })
  }

  return prisma.menu.update({ where: { id }, data: { isActive: false } })
})
