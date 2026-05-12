import { decryptUtf8 } from '../../../utils/crypto'
import { hashEmail, hashName, hashPhone } from '../../../utils/hash'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'

// 顧客検索（物販販売モーダル用）。
// ?q=検索ワード で名前・電話・メールのハッシュ完全一致で検索する。
// 暗号化されたカラムは復号できないため、検索は hash 列を使う。
// 最大 20 件返す。
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sale:view')

  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q.trim() : ''
  if (!q) return []

  // 名前・電話・メールそれぞれの hash で OR 検索
  const where = {
    OR: [
      { nameHash: hashName(q) },
      ...(q.replace(/\D+/g, '').length > 0 ? [{ phoneHash: hashPhone(q) }] : []),
      ...(q.includes('@') ? [{ emailHash: hashEmail(q) }] : []),
    ],
  }

  const customers = await prisma.customer.findMany({
    where,
    take: 20,
    orderBy: { id: 'desc' },
    select: { id: true, name: true, phone: true, email: true, createdAt: true },
  })

  const safeDecrypt = (enc: string | null): string | null => {
    if (!enc) return null
    try { return decryptUtf8(enc) }
    catch { return null }
  }

  return customers.map(c => ({
    id: c.id,
    name: safeDecrypt(c.name),
    phone: safeDecrypt(c.phone),
    email: safeDecrypt(c.email),
    createdAt: c.createdAt,
  }))
})
