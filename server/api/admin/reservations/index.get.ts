import type { Prisma } from '@prisma/client'
import { decryptUtf8 } from '../../../utils/crypto'
import { hashEmail, hashName, hashPhone } from '../../../utils/hash'
import { prisma } from '../../../utils/prisma'

// 管理画面: 予約一覧
// クエリ:
//   ?storeId        絞り込み（省略 = 全店舗）
//   ?status         CONFIRMED | CANCELLED | NO_SHOW (省略 = 全部)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  日付範囲（startAt ベース）
//   ?q              顧客名 / 電話 / メール / 予約コード で検索（hash 一致で個人情報を復号せず検索可能）
//   ?page=1&pageSize=50  ページネーション
//
// 顧客名は復号して返す（管理画面なので OK）
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const storeIdRaw = typeof query.storeId === 'string' ? Number(query.storeId) : null
  const storeId = Number.isInteger(storeIdRaw) && storeIdRaw && storeIdRaw > 0 ? storeIdRaw : null
  const status = typeof query.status === 'string' ? query.status : ''
  const fromStr = typeof query.from === 'string' ? query.from : ''
  const toStr = typeof query.to === 'string' ? query.to : ''
  const q = typeof query.q === 'string' ? query.q.trim() : ''
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(200, Math.max(10, Number(query.pageSize) || 50))

  const where: Prisma.ReservationWhereInput = {}
  if (storeId) where.storeId = storeId
  if (['CONFIRMED', 'CANCELLED', 'NO_SHOW'].includes(status)) {
    where.status = status as Prisma.ReservationWhereInput['status']
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromStr) && /^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
    where.startAt = {
      gte: new Date(`${fromStr}T00:00:00+09:00`),
      lt: new Date(new Date(`${toStr}T00:00:00+09:00`).getTime() + 86_400_000),
    }
  }
  else if (/^\d{4}-\d{2}-\d{2}$/.test(fromStr)) {
    where.startAt = { gte: new Date(`${fromStr}T00:00:00+09:00`) }
  }
  else if (/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
    where.startAt = { lt: new Date(new Date(`${toStr}T00:00:00+09:00`).getTime() + 86_400_000) }
  }

  // 検索: 予約コード / 顧客名ハッシュ / 電話ハッシュ / メールハッシュ いずれか一致
  if (q) {
    const codeMatch = /^[A-Z0-9]{8}$/.test(q.toUpperCase()) ? q.toUpperCase() : null
    where.OR = [
      ...(codeMatch ? [{ confirmationCode: codeMatch }] : []),
      { customer: { nameHash: hashName(q) } },
      { customer: { phoneHash: hashPhone(q) } },
      { customer: { emailHash: hashEmail(q) } },
    ]
  }

  const [total, items] = await Promise.all([
    prisma.reservation.count({ where }),
    prisma.reservation.findMany({
      where,
      orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        store: { select: { id: true, name: true } },
        bed: { select: { id: true, name: true } },
        practitioner: { select: { id: true, name: true } },
        menu: { select: { id: true, name: true, durationMinutes: true, priceJpy: true } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    }),
  ])

  // 顧客情報を復号（失敗時は null）
  const decoded = items.map((r) => {
    const safeDecrypt = (enc: string | null): string | null => {
      if (!enc) return null
      try {
        return decryptUtf8(enc)
      }
      catch {
        return null
      }
    }
    return {
      ...r,
      customer: {
        id: r.customer.id,
        name: safeDecrypt(r.customer.name),
        phone: safeDecrypt(r.customer.phone),
        email: safeDecrypt(r.customer.email),
      },
    }
  })

  return {
    items: decoded,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
})
