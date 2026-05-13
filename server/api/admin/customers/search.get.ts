import { decryptUtf8 } from '../../../utils/crypto'
import { hashEmail, hashName, hashPhone } from '../../../utils/hash'
import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/requirePermission'

// 顧客検索（物販販売モーダルなど）。
// ?q=検索ワード で名前・電話・メールを部分一致で検索する。
//
// 暗号化された値は DB レベルで部分一致できないため、以下の戦略で動かす:
//   1. まず hash 完全一致で 1 件だけ拾えるか試す（速い）
//   2. ヒットしなければ最新 1000 件を復号して JavaScript で部分一致フィルタ
// 顧客数が 1000 件を超えるまでは実用上 OK。それ以上に増えたら全文検索の導入を検討。
//
// 上限 20 件返す。
export default defineEventHandler(async (event) => {
  // customer:view または sale:view のどちらかを持つユーザーが利用可能
  // （customer:view: 顧客管理画面、sale:view: 物販販売モーダル）
  const user = await requireUser(event)
  const perms = user.permissions ?? []
  if (!perms.includes('customer:view') && !perms.includes('sale:view')) {
    throw createError({ statusCode: 403, statusMessage: '権限がありません' })
  }

  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q.trim() : ''
  if (q.length < 1) return []

  // 1. まず hash 完全一致を試す（電話番号やメアドを正確に入力したケース向けに速いパスを残す）
  const exactWhere = {
    OR: [
      { nameHash: hashName(q) },
      ...(q.replace(/\D+/g, '').length > 0 ? [{ phoneHash: hashPhone(q) }] : []),
      ...(q.includes('@') ? [{ emailHash: hashEmail(q) }] : []),
    ],
  }
  const exactHits = await prisma.customer.findMany({
    where: exactWhere,
    take: 20,
    orderBy: { id: 'desc' },
    select: { id: true, name: true, phone: true, email: true, createdAt: true },
  })

  const safeDecrypt = (enc: string | null): string | null => {
    if (!enc) return null
    try { return decryptUtf8(enc) }
    catch { return null }
  }

  const decode = (c: { id: number, name: string | null, phone: string | null, email: string | null, createdAt: Date }) => ({
    id: c.id,
    name: safeDecrypt(c.name),
    phone: safeDecrypt(c.phone),
    email: safeDecrypt(c.email),
    createdAt: c.createdAt,
  })

  if (exactHits.length > 0) {
    return exactHits.map(decode)
  }

  // 2. フォールバック: 最新 1000 件を復号して部分一致フィルタ
  // 退会済を除外（混乱を避けるため）
  const recent = await prisma.customer.findMany({
    where: { withdrawnAt: null },
    take: 1000,
    orderBy: { id: 'desc' },
    select: { id: true, name: true, phone: true, email: true, createdAt: true },
  })

  const needle = q.toLowerCase()
  const needleDigits = q.replace(/\D+/g, '')

  const filtered = recent
    .map(decode)
    .filter((c) => {
      const nameMatch = c.name && c.name.toLowerCase().includes(needle)
      // 電話は数字以外を除去して比較（"090-1234" でも "09012" でもヒット）
      const phoneMatch = c.phone && needleDigits.length > 0
        && c.phone.replace(/\D+/g, '').includes(needleDigits)
      const emailMatch = c.email && c.email.toLowerCase().includes(needle)
      return nameMatch || phoneMatch || emailMatch
    })
    .slice(0, 20)

  return filtered
})
