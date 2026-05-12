import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'

// 商品マスタ一覧。
// ?status=active|inactive|all（デフォルト all）
// ?storeId=N（店舗特別商品を絞り込み）
// ?kind=PRODUCT|VOUCHER で種別フィルタ
// ?includeCommon=true なら storeId フィルタ時に共通商品（storeId IS NULL）も含める
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'product:view')

  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status : 'all'
  const kind = typeof query.kind === 'string' ? query.kind : 'all'
  const storeIdRaw = typeof query.storeId === 'string' ? Number(query.storeId) : null
  const storeId = Number.isInteger(storeIdRaw) && storeIdRaw && storeIdRaw > 0 ? storeIdRaw : null
  const includeCommon = query.includeCommon === 'true'

  const statusFilter
    = status === 'active' ? { isActive: true }
      : status === 'inactive' ? { isActive: false }
        : {}

  const kindFilter
    = kind === 'PRODUCT' ? { kind: 'PRODUCT' as const }
      : kind === 'VOUCHER' ? { kind: 'VOUCHER' as const }
        : {}

  const storeFilter
    = storeId
      ? includeCommon
        ? { OR: [{ storeId }, { storeId: null }] }
        : { storeId }
      : {}

  return prisma.product.findMany({
    where: { ...statusFilter, ...kindFilter, ...storeFilter },
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
