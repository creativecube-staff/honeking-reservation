import { prisma } from '../../../utils/prisma'

// 共通メニュー（storeId IS NULL）の一覧。?status=active|inactive|all
// 各メニューに excludedStoreIds: number[] を付けて返す（編集モーダルのチェックボックス初期値用）。
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status : 'all'

  const where: Record<string, unknown> = { storeId: null }
  if (status === 'active') where.isActive = true
  else if (status === 'inactive') where.isActive = false

  const menus = await prisma.menu.findMany({
    where,
    orderBy: [
      { displayOrder: 'asc' },
      { id: 'asc' },
    ],
    include: {
      excludedStores: { select: { storeId: true } },
    },
  })

  return menus.map(({ excludedStores, ...m }) => ({
    ...m,
    excludedStoreIds: excludedStores.map(e => e.storeId),
  }))
})
