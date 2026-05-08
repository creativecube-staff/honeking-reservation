import { Prisma } from '@prisma/client'
import { updateMenuSchema } from '../../../../shared/schemas/menu'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
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

  // 共通メニュー（storeId IS NULL）であることを確認
  const menu = await prisma.menu.findFirst({ where: { id, storeId: null }, select: { id: true } })
  if (!menu) {
    throw createError({ statusCode: 404, statusMessage: '共通メニューが見つかりません' })
  }

  const { availableFrom, availableUntil, ...rest } = parsed.data
  const data: Prisma.MenuUpdateInput = { ...rest }
  if (availableFrom !== undefined) {
    data.availableFrom = availableFrom == null ? null : new Date(availableFrom)
  }
  if (availableUntil !== undefined) {
    data.availableUntil = availableUntil == null ? null : new Date(availableUntil)
  }

  try {
    return await prisma.menu.update({ where: { id }, data })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: '同名の共通メニューがすでに存在します' })
    }
    throw e
  }
})
