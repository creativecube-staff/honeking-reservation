import { prisma } from '../../../../../utils/prisma'

// 店舗特別メニュー一覧。
// 差し替え対象の共通メニュー名（あれば）を一覧表示に使うので include で名前だけ持ってくる。
export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な店舗 ID です' })
  }

  const menus = await prisma.menu.findMany({
    where: { storeId },
    orderBy: [
      { displayOrder: 'asc' },
      { id: 'asc' },
    ],
    include: {
      replaces: { select: { id: true, name: true } },
    },
  })

  return menus.map(({ replaces, ...m }) => ({
    ...m,
    replacesMenu: replaces ?? null,
  }))
})
