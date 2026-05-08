import { prisma } from '../../../utils/prisma'

// 共通メニュー（storeId IS NULL）の一覧。?status=active|inactive|all
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status : 'all'

  const where: Record<string, unknown> = { storeId: null }
  if (status === 'active') where.isActive = true
  else if (status === 'inactive') where.isActive = false

  return prisma.menu.findMany({
    where,
    orderBy: [
      { displayOrder: 'asc' },
      { id: 'asc' },
    ],
  })
})
