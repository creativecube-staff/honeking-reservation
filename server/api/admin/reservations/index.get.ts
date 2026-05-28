import type { Prisma } from '@prisma/client'
import { decryptUtf8 } from '../../../utils/crypto'
import { hashEmail, hashName, hashPhone } from '../../../utils/hash'
import { prisma } from '../../../utils/prisma'
import { parseStoreIdQuery, resolveStoreScope } from '../../../utils/storeScope'

// 管理画面: 予約一覧
// クエリ:
//   ?storeId        絞り込み（省略 = 全店舗）
//   ?bedId          ベッド絞り込み（省略 = 全ベッド。通常 storeId と組み合わせ）
//   ?customerId     特定顧客の予約のみ（顧客詳細ページから利用）
//   ?status         表示ステータス UPCOMING | COMPLETED | NO_SHOW | CANCELLED (省略 = 全部)
//     - UPCOMING:  DB status=CONFIRMED かつ endAt > 現在（=「予約済」）
//     - COMPLETED: DB status=CONFIRMED かつ endAt <= 現在（=「完了」）
//     - NO_SHOW:   DB status=NO_SHOW
//     - CANCELLED: DB status=CANCELLED
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  日付範囲（startAt ベース）
//   ?q              顧客名 / 電話 / メール / 予約コード で検索（hash 一致で個人情報を復号せず検索可能）
//   ?page=1&pageSize=50  ページネーション
//
// 顧客名は復号して返す（管理画面なので OK）
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  // 店舗スコープ: OWNER は ?storeId で各店 / 省略で全店。それ以外は所属店舗に固定（越権は403）
  const { storeId } = await resolveStoreScope(event, parseStoreIdQuery(query.storeId))
  const bedIdRaw = typeof query.bedId === 'string' ? Number(query.bedId) : null
  const bedId = Number.isInteger(bedIdRaw) && bedIdRaw && bedIdRaw > 0 ? bedIdRaw : null
  const customerIdRaw = typeof query.customerId === 'string' ? Number(query.customerId) : null
  const customerId = Number.isInteger(customerIdRaw) && customerIdRaw && customerIdRaw > 0 ? customerIdRaw : null
  const status = typeof query.status === 'string' ? query.status : ''
  const fromStr = typeof query.from === 'string' ? query.from : ''
  const toStr = typeof query.to === 'string' ? query.to : ''
  const q = typeof query.q === 'string' ? query.q.trim() : ''
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(200, Math.max(10, Number(query.pageSize) || 50))

  const now = new Date()
  const where: Prisma.ReservationWhereInput = {}
  if (storeId) where.storeId = storeId
  if (bedId) where.bedId = bedId
  if (customerId) where.customerId = customerId
  // 表示ステータスを DB 条件に解釈
  if (status === 'UPCOMING') {
    where.status = 'CONFIRMED'
    where.endAt = { gt: now }
  }
  else if (status === 'COMPLETED') {
    where.status = 'CONFIRMED'
    where.endAt = { lte: now }
  }
  else if (status === 'NO_SHOW') {
    where.status = 'NO_SHOW'
  }
  else if (status === 'CANCELLED') {
    where.status = 'CANCELLED'
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
        staff: { select: { id: true, name: true } },
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
