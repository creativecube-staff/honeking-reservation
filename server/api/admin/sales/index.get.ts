import { decryptUtf8 } from '../../../utils/crypto'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'

// 販売履歴一覧。
// ?storeId / ?from=YYYY-MM-DD&to=YYYY-MM-DD / ?customerId / ?productId
// ?kind=PRODUCT|VOUCHER（商品種別フィルタ）
// ?noReservation=true（予約に紐付かない独立販売のみ）
// 顧客名は復号して返す。
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sale:view')

  const query = getQuery(event)
  const storeIdRaw = typeof query.storeId === 'string' ? Number(query.storeId) : null
  const storeId = Number.isInteger(storeIdRaw) && storeIdRaw && storeIdRaw > 0 ? storeIdRaw : null
  const customerIdRaw = typeof query.customerId === 'string' ? Number(query.customerId) : null
  const customerId = Number.isInteger(customerIdRaw) && customerIdRaw && customerIdRaw > 0 ? customerIdRaw : null
  const productIdRaw = typeof query.productId === 'string' ? Number(query.productId) : null
  const productId = Number.isInteger(productIdRaw) && productIdRaw && productIdRaw > 0 ? productIdRaw : null
  const fromStr = typeof query.from === 'string' ? query.from : ''
  const toStr = typeof query.to === 'string' ? query.to : ''
  const kind = typeof query.kind === 'string' ? query.kind : 'all'
  const noReservation = query.noReservation === 'true'

  const where: Record<string, unknown> = {}
  if (storeId) where.storeId = storeId
  if (customerId) where.customerId = customerId
  if (productId) where.productId = productId
  if (noReservation) where.reservationId = null
  if (kind === 'PRODUCT' || kind === 'VOUCHER') {
    where.product = { kind }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromStr) && /^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
    where.soldAt = {
      gte: new Date(`${fromStr}T00:00:00+09:00`),
      lt: new Date(new Date(`${toStr}T00:00:00+09:00`).getTime() + 86_400_000),
    }
  }
  else if (/^\d{4}-\d{2}-\d{2}$/.test(fromStr)) {
    where.soldAt = { gte: new Date(`${fromStr}T00:00:00+09:00`) }
  }
  else if (/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
    where.soldAt = { lt: new Date(new Date(`${toStr}T00:00:00+09:00`).getTime() + 86_400_000) }
  }

  const sales = await prisma.productSale.findMany({
    where,
    orderBy: [{ soldAt: 'desc' }, { id: 'desc' }],
    include: {
      product: { select: { id: true, name: true, kind: true, voucherTotalUses: true } },
      store: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
      soldByPractitioner: { select: { id: true, name: true } },
      reservation: { select: { id: true, confirmationCode: true } },
      voucher: { select: { id: true, totalUses: true, remainingUses: true } },
    },
  })

  const safeDecrypt = (enc: string | null): string | null => {
    if (!enc) return null
    try { return decryptUtf8(enc) }
    catch { return null }
  }

  return sales.map(s => ({
    ...s,
    customer: { id: s.customer.id, name: safeDecrypt(s.customer.name) },
  }))
})
