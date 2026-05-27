import { prisma } from '../../../utils/prisma'
import { parseStoreIdQuery, resolveStoreScope } from '../../../utils/storeScope'

// ダッシュボード概要ウィジェット用のカウント + 店舗別売上集計
//
// 店舗スコープ:
//   - OWNER は ?storeId 指定で各店、省略で全店舗集計
//   - それ以外は所属店舗に固定（越権は 403）
//   - storeId が null のとき = 全店舗
//
// 売上の定義:
//   - 施術売上: CONFIRMED で VoucherUsage を持たない予約の menu.priceJpy 合計
//     （回数券消費した予約は売上ゼロ。回数券販売日に計上済み）
//   - 物販・回数券販売: ProductSale の unitPriceJpyAtSale × quantity 合計
//   - 「終了時刻ベース」ではなく「予約開始日」「販売日」で集計する
export default defineEventHandler(async (event) => {
  const { storeId } = await resolveStoreScope(event, parseStoreIdQuery(getQuery(event).storeId))

  const now = new Date()
  const jstNow = new Date(now.getTime() + 9 * 3600_000)
  const y = jstNow.getUTCFullYear()
  const m = jstNow.getUTCMonth()
  const d = jstNow.getUTCDate()
  const todayStart = new Date(Date.UTC(y, m, d, -9, 0, 0))
  const todayEnd = new Date(todayStart.getTime() + 86_400_000)
  const todayDow = jstNow.getUTCDay()
  const weekStart = new Date(todayStart.getTime() - todayDow * 86_400_000)
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000)
  // 今月: JST 月初〜翌月初
  const monthStart = new Date(Date.UTC(y, m, 1, -9, 0, 0))
  const monthEnd = new Date(Date.UTC(y, m + 1, 1, -9, 0, 0))

  // 店舗フィルタ断片。storeId が null（全店舗）なら何も絞らない。
  const storeWhere = storeId ? { storeId } : {}
  // メニューは「共通(storeId=null) + その店の特別」。全店舗時は全メニュー。
  const menuWhere = storeId
    ? { isActive: true, OR: [{ storeId: null }, { storeId }] }
    : { isActive: true }
  // 店舗一覧（売上バケットの土台）。スコープ時は対象店舗のみ。
  const storeListWhere = storeId ? { id: storeId, isActive: true } : { isActive: true }

  const [storesActive, beds, staff, menus, holidaysFuture, todayReservations, weekReservations, upcomingConfirmed, storesList, monthMenuRevenueRows, monthSaleRevenueRows, todayMenuRevenueRows, todaySaleRevenueRows] = await Promise.all([
    prisma.store.count({ where: storeListWhere }),
    prisma.bed.count({ where: { isActive: true, ...storeWhere } }),
    prisma.practitioner.count({ where: { isActive: true, isAssignable: true, ...storeWhere } }),
    prisma.menu.count({ where: menuWhere }),
    prisma.holiday.count({ where: { date: { gte: todayStart }, ...storeWhere } }),
    prisma.reservation.count({
      where: { status: 'CONFIRMED', startAt: { gte: todayStart, lt: todayEnd }, ...storeWhere },
    }),
    prisma.reservation.count({
      where: { status: 'CONFIRMED', startAt: { gte: weekStart, lt: weekEnd }, ...storeWhere },
    }),
    prisma.reservation.count({
      where: { status: 'CONFIRMED', startAt: { gte: now }, ...storeWhere },
    }),
    prisma.store.findMany({ where: storeListWhere, orderBy: { displayOrder: 'asc' }, select: { id: true, name: true } }),
    // 今月の施術売上候補: CONFIRMED かつ回数券消費なし
    prisma.reservation.findMany({
      where: {
        status: 'CONFIRMED',
        startAt: { gte: monthStart, lt: monthEnd },
        voucherUsage: { is: null },
        ...storeWhere,
      },
      select: { storeId: true, menu: { select: { priceJpy: true } } },
    }),
    prisma.productSale.findMany({
      where: { soldAt: { gte: monthStart, lt: monthEnd }, ...storeWhere },
      select: { storeId: true, quantity: true, unitPriceJpyAtSale: true },
    }),
    prisma.reservation.findMany({
      where: {
        status: 'CONFIRMED',
        startAt: { gte: todayStart, lt: todayEnd },
        voucherUsage: { is: null },
        ...storeWhere,
      },
      select: { storeId: true, menu: { select: { priceJpy: true } } },
    }),
    prisma.productSale.findMany({
      where: { soldAt: { gte: todayStart, lt: todayEnd }, ...storeWhere },
      select: { storeId: true, quantity: true, unitPriceJpyAtSale: true },
    }),
  ])

  // 店舗別売上集計
  type RevenueBucket = { storeId: number, storeName: string, menu: number, sale: number, total: number }
  const buildBuckets = (
    menuRows: { storeId: number, menu: { priceJpy: number } }[],
    saleRows: { storeId: number, quantity: number, unitPriceJpyAtSale: number }[],
  ): RevenueBucket[] => {
    const map = new Map<number, RevenueBucket>()
    for (const s of storesList) {
      map.set(s.id, { storeId: s.id, storeName: s.name, menu: 0, sale: 0, total: 0 })
    }
    for (const r of menuRows) {
      const b = map.get(r.storeId)
      if (b) b.menu += r.menu.priceJpy
    }
    for (const s of saleRows) {
      const b = map.get(s.storeId)
      if (b) b.sale += s.unitPriceJpyAtSale * s.quantity
    }
    for (const b of map.values()) b.total = b.menu + b.sale
    return Array.from(map.values())
  }

  const revenueThisMonth = buildBuckets(monthMenuRevenueRows, monthSaleRevenueRows)
  const revenueToday = buildBuckets(todayMenuRevenueRows, todaySaleRevenueRows)

  return {
    stores: storesActive,
    beds,
    staff,
    menus,
    holidaysFuture,
    todayReservations,
    weekReservations,
    upcomingConfirmed,
    revenueToday,
    revenueThisMonth,
  }
})
