import { prisma } from '../../../utils/prisma'

// ダッシュボード概要ウィジェット用のカウント + 店舗別売上集計
//
// 売上の定義:
//   - 施術売上: CONFIRMED で VoucherUsage を持たない予約の menu.priceJpy 合計
//     （回数券消費した予約は売上ゼロ。回数券販売日に計上済み）
//   - 物販・回数券販売: ProductSale の unitPriceJpyAtSale × quantity 合計
//   - 「終了時刻ベース」ではなく「予約開始日」「販売日」で集計する
export default defineEventHandler(async () => {
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

  const [storesActive, beds, staff, menus, holidaysFuture, todayReservations, weekReservations, upcomingConfirmed, storesList, monthMenuRevenueRows, monthSaleRevenueRows, todayMenuRevenueRows, todaySaleRevenueRows] = await Promise.all([
    prisma.store.count({ where: { isActive: true } }),
    prisma.bed.count({ where: { isActive: true } }),
    prisma.practitioner.count({ where: { isActive: true, isAssignable: true } }),
    prisma.menu.count({ where: { isActive: true } }),
    prisma.holiday.count({ where: { date: { gte: todayStart } } }),
    prisma.reservation.count({
      where: { status: 'CONFIRMED', startAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.reservation.count({
      where: { status: 'CONFIRMED', startAt: { gte: weekStart, lt: weekEnd } },
    }),
    prisma.reservation.count({
      where: { status: 'CONFIRMED', startAt: { gte: now } },
    }),
    prisma.store.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' }, select: { id: true, name: true } }),
    // 今月の施術売上候補: CONFIRMED かつ回数券消費なし
    prisma.reservation.findMany({
      where: {
        status: 'CONFIRMED',
        startAt: { gte: monthStart, lt: monthEnd },
        voucherUsage: { is: null },
      },
      select: { storeId: true, menu: { select: { priceJpy: true } } },
    }),
    prisma.productSale.findMany({
      where: { soldAt: { gte: monthStart, lt: monthEnd } },
      select: { storeId: true, quantity: true, unitPriceJpyAtSale: true },
    }),
    prisma.reservation.findMany({
      where: {
        status: 'CONFIRMED',
        startAt: { gte: todayStart, lt: todayEnd },
        voucherUsage: { is: null },
      },
      select: { storeId: true, menu: { select: { priceJpy: true } } },
    }),
    prisma.productSale.findMany({
      where: { soldAt: { gte: todayStart, lt: todayEnd } },
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
