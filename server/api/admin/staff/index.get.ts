import { prisma } from '../../../utils/prisma'

// 全スタッフ一覧。
// ?status=active|inactive|all（デフォルト all）
// ?storeId=N でメイン店舗フィルタ
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status : 'all'
  const storeIdRaw = typeof query.storeId === 'string' ? Number(query.storeId) : null
  const storeFilter = Number.isInteger(storeIdRaw) && storeIdRaw && storeIdRaw > 0
    ? { storeId: storeIdRaw }
    : {}

  const statusFilter
    = status === 'active' ? { isActive: true }
      : status === 'inactive' ? { isActive: false }
        : {}

  return prisma.practitioner.findMany({
    where: { ...storeFilter, ...statusFilter },
    orderBy: [
      { storeId: 'asc' },
      { displayOrder: 'asc' },
      { id: 'asc' },
    ],
    include: {
      store: { select: { id: true, name: true, slug: true } },
    },
  })
})
