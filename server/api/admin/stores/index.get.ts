import { prisma } from '../../../utils/prisma'

// 管理画面用の店舗一覧。?status=active|inactive|all（デフォルト all）
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status : 'all'

  const where
    = status === 'active' ? { isActive: true }
      : status === 'inactive' ? { isActive: false }
        : {}

  return prisma.store.findMany({
    where,
    orderBy: [
      { displayOrder: 'asc' },
      { id: 'asc' },
    ],
  })
})
