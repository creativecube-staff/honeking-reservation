import { Prisma } from '@prisma/client'
import { createMenuSchema } from '../../../../../../shared/schemas/menu'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な店舗 ID です' })
  }

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true } })
  if (!store) {
    throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })
  }

  const body = await readBody(event)
  const parsed = createMenuSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  // excludedStoreIds は共通メニュー専用なので店舗特別メニューでは無視
  const { availableFrom, availableUntil, excludedStoreIds, replacesMenuId, ...rest } = parsed.data
  void excludedStoreIds

  // 差し替え対象が指定されている場合は、有効な共通メニューであることを確認
  if (replacesMenuId != null) {
    const target = await prisma.menu.findFirst({
      where: { id: replacesMenuId, storeId: null },
      select: { id: true, isActive: true },
    })
    if (!target) {
      throw createError({ statusCode: 400, statusMessage: '差し替え対象には有効な共通メニューを指定してください' })
    }
  }

  try {
    return await prisma.menu.create({
      data: {
        ...rest,
        storeId,
        replacesMenuId: replacesMenuId ?? null,
        availableFrom: availableFrom == null ? null : new Date(availableFrom),
        availableUntil: availableUntil == null ? null : new Date(availableUntil),
      },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: '同名のメニューがすでに存在します' })
    }
    throw e
  }
})
