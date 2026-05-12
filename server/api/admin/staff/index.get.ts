import { prisma } from '../../../utils/prisma'

// 全スタッフ一覧。
// ?status=active|inactive|all（デフォルト all）
// ?storeId=N でメイン店舗フィルタ
// ?assignable=true|false|all（デフォルト all）
//   - true: 予約に割り当てられるスタッフのみ（シフト管理・予約画面用、オーナー等の特別アカウントを除外）
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status : 'all'
  const assignable = typeof query.assignable === 'string' ? query.assignable : 'all'
  const storeIdRaw = typeof query.storeId === 'string' ? Number(query.storeId) : null
  const storeFilter = Number.isInteger(storeIdRaw) && storeIdRaw && storeIdRaw > 0
    ? { storeId: storeIdRaw }
    : {}

  const statusFilter
    = status === 'active' ? { isActive: true }
      : status === 'inactive' ? { isActive: false }
        : {}

  const assignableFilter
    = assignable === 'true' ? { isAssignable: true }
      : assignable === 'false' ? { isAssignable: false }
        : {}

  return prisma.practitioner.findMany({
    where: { ...storeFilter, ...statusFilter, ...assignableFilter },
    orderBy: [
      { storeId: 'asc' },
      { displayOrder: 'asc' },
      { id: 'asc' },
    ],
    select: {
      id: true, storeId: true, name: true, displayOrder: true, isActive: true,
      isAssignable: true, canLogin: true, username: true, role: true, permissions: true,
      createdAt: true, updatedAt: true,
      store: { select: { id: true, name: true, slug: true } },
    },
  })
})
