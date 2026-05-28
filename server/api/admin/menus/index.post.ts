import { Prisma } from '@prisma/client'
import { createMenuSchema } from '../../../../shared/schemas/menu'
import { prisma } from '../../../utils/prisma'

// 共通メニューを作成（storeId は強制的に null）。
// 同時に MenuStoreExclusion で「この店舗では非表示」を登録する。
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = createMenuSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  // replacesMenuId は店舗特別メニュー専用フィールドのため共通側では受け付けず null に強制
  const { availableFrom, availableUntil, excludedStoreIds, replacesMenuId, ...rest } = parsed.data
  void replacesMenuId

  try {
    // メニュー作成 + 除外店舗の登録を 1 トランザクションにまとめる
    return await prisma.$transaction(async (tx) => {
      const menu = await tx.menu.create({
        data: {
          ...rest,
          storeId: null,
          replacesMenuId: null,
          availableFrom: availableFrom == null ? null : new Date(availableFrom),
          availableUntil: availableUntil == null ? null : new Date(availableUntil),
        },
      })
      if (excludedStoreIds.length > 0) {
        await tx.menuStoreExclusion.createMany({
          data: excludedStoreIds.map(storeId => ({ menuId: menu.id, storeId })),
        })
      }
      return menu
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: '同名の共通メニューがすでに存在します' })
    }
    throw e
  }
})
