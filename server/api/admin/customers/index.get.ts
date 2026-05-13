import type { Prisma } from '@prisma/client'
import { decryptUtf8 } from '../../../utils/crypto'
import { hashEmail, hashName, hashPhone } from '../../../utils/hash'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'

// 管理画面: 顧客一覧
// クエリ:
//   ?membership=all|member|pending|guest|dormant|withdrawn  会員区分フィルタ
//     - member    本会員（passwordHash + emailVerifiedAt あり + 未退会）
//     - pending   仮登録（passwordHash あり + emailVerifiedAt なし + 未退会）
//     - guest     ゲスト予約のみ（passwordHash なし + 未退会）
//     - dormant   休眠: 過去に来店歴があるが、最終来店日が dormantDays 日以上前
//     - withdrawn 退会済（withdrawnAt あり）
//   ?dormantDays=30   休眠判定の閾値（default 30、membership=dormant のときのみ意味あり）
//   ?q              氏名 / 電話 / メールで検索（hash 一致で個人情報を復号せず検索可能）
//   ?sort=createdAt|lastLoginAt   並び順（既定: createdAt）
//   ?order=desc|asc               昇降順（既定: desc）
//   ?page=1&pageSize=50           ページネーション
//
// 各顧客の最終来店日（lastVisitAt）と予約中件数（upcomingCount）も併せて返す。
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'customer:view')

  const query = getQuery(event)
  const membership = typeof query.membership === 'string' ? query.membership : 'all'
  const dormantDays = Math.max(1, Math.min(3650, Number(query.dormantDays) || 30))
  const q = typeof query.q === 'string' ? query.q.trim() : ''
  const sort = query.sort === 'lastLoginAt' ? 'lastLoginAt' : 'createdAt'
  const order = query.order === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(200, Math.max(10, Number(query.pageSize) || 50))

  const now = new Date()
  const where: Prisma.CustomerWhereInput = {}

  // 会員区分
  if (membership === 'member') {
    where.passwordHash = { not: null }
    where.emailVerifiedAt = { not: null }
    where.withdrawnAt = null
  }
  else if (membership === 'pending') {
    where.passwordHash = { not: null }
    where.emailVerifiedAt = null
    where.withdrawnAt = null
  }
  else if (membership === 'guest') {
    where.passwordHash = null
    where.withdrawnAt = null
  }
  else if (membership === 'withdrawn') {
    where.withdrawnAt = { not: null }
  }
  else if (membership === 'dormant') {
    // 休眠: 過去に来店があり、その最終来店日が閾値より前。退会済は除外。
    const threshold = new Date(now.getTime() - dormantDays * 86_400_000)
    const dormantGroups = await prisma.reservation.groupBy({
      by: ['customerId'],
      where: {
        status: 'CONFIRMED',
        endAt: { lt: now }, // 完了済
      },
      _max: { startAt: true },
      having: {
        startAt: { _max: { lt: threshold } },
      },
    })
    where.id = { in: dormantGroups.map(g => g.customerId) }
    where.withdrawnAt = null
  }

  // 検索: 氏名 / 電話 / メールいずれかの hash 一致
  if (q) {
    where.OR = [
      { nameHash: hashName(q) },
      ...(q.replace(/\D+/g, '').length > 0 ? [{ phoneHash: hashPhone(q) }] : []),
      ...(q.includes('@') ? [{ emailHash: hashEmail(q) }] : []),
    ]
  }

  const [total, items] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: [{ [sort]: order }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        passwordHash: true,
        emailVerifiedAt: true,
        withdrawnAt: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { reservations: true } },
      },
    }),
  ])

  // 各顧客の最終来店日（完了済）と予約中件数（未来の CONFIRMED）を一括取得（N+1 回避）
  const customerIds = items.map(c => c.id)
  const [lastVisits, upcomingCounts] = customerIds.length === 0
    ? [[], []]
    : await Promise.all([
        prisma.reservation.groupBy({
          by: ['customerId'],
          where: {
            customerId: { in: customerIds },
            status: 'CONFIRMED',
            endAt: { lt: now },
          },
          _max: { startAt: true },
        }),
        prisma.reservation.groupBy({
          by: ['customerId'],
          where: {
            customerId: { in: customerIds },
            status: 'CONFIRMED',
            startAt: { gt: now },
          },
          _count: { _all: true },
        }),
      ])

  const lastVisitMap = new Map<number, Date>()
  for (const g of lastVisits) {
    if (g._max.startAt) lastVisitMap.set(g.customerId, g._max.startAt)
  }
  const upcomingMap = new Map<number, number>()
  for (const g of upcomingCounts) {
    upcomingMap.set(g.customerId, g._count._all)
  }

  const safeDecrypt = (enc: string | null): string | null => {
    if (!enc) return null
    try { return decryptUtf8(enc) }
    catch { return null }
  }

  const decoded = items.map(c => ({
    id: c.id,
    name: safeDecrypt(c.name),
    phone: safeDecrypt(c.phone),
    email: safeDecrypt(c.email),
    membership:
      c.withdrawnAt ? 'withdrawn'
        : c.passwordHash && c.emailVerifiedAt ? 'member'
          : c.passwordHash ? 'pending'
              : 'guest',
    withdrawnAt: c.withdrawnAt,
    lastLoginAt: c.lastLoginAt,
    createdAt: c.createdAt,
    reservationCount: c._count.reservations,
    lastVisitAt: lastVisitMap.get(c.id) ?? null,
    upcomingCount: upcomingMap.get(c.id) ?? 0,
  }))

  return {
    items: decoded,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
})
