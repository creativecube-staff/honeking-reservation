import { Prisma } from '@prisma/client'
import { updateMenuSchema } from '../../../../../../shared/schemas/menu'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  const menuId = Number(getRouterParam(event, 'menuId'))
  if (!Number.isInteger(storeId) || storeId <= 0 || !Number.isInteger(menuId) || menuId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const body = await readBody(event)
  const parsed = updateMenuSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  const menu = await prisma.menu.findFirst({ where: { id: menuId, storeId }, select: { id: true } })
  if (!menu) {
    throw createError({ statusCode: 404, statusMessage: 'メニューが見つかりません' })
  }

  try {
    return await prisma.menu.update({ where: { id: menuId }, data: parsed.data })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: '同名のメニューがすでに存在します' })
    }
    throw e
  }
})
