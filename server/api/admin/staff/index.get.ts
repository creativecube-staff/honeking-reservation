import { parseStoreIdQuery, resolveStoreScope } from '../../../utils/storeScope'
import { prisma } from '../../../utils/prisma'

// スタッフ一覧（Staff テーブル）。
// ?status=active|inactive|all（デフォルト all）
// ?assignable=true|false|all（デフォルト all）
// ?storeId=N で店舗を絞る（OWNER のみ任意の店舗を選べる。それ以外は所属店舗に固定）
//   storeId 未指定 + OWNER のとき = 全店舗のスタッフを返す
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status : 'all'
  const assignable = typeof query.assignable === 'string' ? query.assignable : 'all'

  const { storeId } = await resolveStoreScope(event, parseStoreIdQuery(query.storeId))
  const storeFilter = storeId == null ? {} : { storeId }

  const statusFilter
    = status === 'active' ? { isActive: true }
      : status === 'inactive' ? { isActive: false }
        : {}

  const assignableFilter
    = assignable === 'true' ? { isAssignable: true }
      : assignable === 'false' ? { isAssignable: false }
        : {}

  return prisma.staff.findMany({
    where: { ...storeFilter, ...statusFilter, ...assignableFilter },
    orderBy: [
      { storeId: 'asc' },
      { displayOrder: 'asc' },
      { id: 'asc' },
    ],
    select: {
      id: true, storeId: true, name: true, gender: true, role: true, baseShiftDays: true,
      displayOrder: true, assignOrder: true, isActive: true, isAssignable: true,
      createdAt: true, updatedAt: true,
      store: { select: { id: true, name: true, slug: true } },
    },
  })
})
