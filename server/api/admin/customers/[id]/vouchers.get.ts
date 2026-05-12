import { prisma } from '../../../../utils/prisma'
import { requirePermission } from '../../../../utils/requirePermission'

// 顧客が保有する回数券一覧。残回数 0 のものも含めて返し、UI で「残あり」「使い切り」を判別する。
// ?activeOnly=true なら remainingUses > 0 のみ返す（消費フォーム用）。
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sale:view')

  const customerId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const query = getQuery(event)
  const activeOnly = query.activeOnly === 'true'

  return prisma.customerVoucher.findMany({
    where: {
      customerId,
      ...(activeOnly ? { remainingUses: { gt: 0 } } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      product: { select: { id: true, name: true, priceJpy: true } },
    },
  })
})
