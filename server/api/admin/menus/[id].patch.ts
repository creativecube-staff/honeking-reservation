import { Prisma } from '@prisma/client'
import { updateMenuSchema } from '../../../../shared/schemas/menu'
import { prisma } from '../../../utils/prisma'

// 共通メニューの部分更新。本体フィールドと、excludedStoreIds の全置換をまとめる。
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

  // 共通メニュー側では replacesMenuId は受け付けず常に null 扱い
  const { availableFrom, availableUntil, excludedStoreIds, replacesMenuId, ...rest } = parsed.data
  void replacesMenuId
  const data: Prisma.MenuUpdateInput = { ...rest }
  if (availableFrom !== undefined) {
    data.availableFrom = availableFrom == null ? null : new Date(availableFrom)
  }
  if (availableUntil !== undefined) {
    data.availableUntil = availableUntil == null ? null : new Date(availableUntil)
  }

  try {
    // 本体更新 + 除外店舗の全置換を 1 トランザクションでまとめる。
    // excludedStoreIds が未送信(undefined)なら除外行は触らない。
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.menu.update({ where: { id }, data })
      if (excludedStoreIds !== undefined) {
        await tx.menuStoreExclusion.deleteMany({ where: { menuId: id } })
        if (excludedStoreIds.length > 0) {
          await tx.menuStoreExclusion.createMany({
            data: excludedStoreIds.map(storeId => ({ menuId: id, storeId })),
          })
        }
      }
      return updated
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: '同名の共通メニューがすでに存在します' })
    }
    throw e
  }
})
