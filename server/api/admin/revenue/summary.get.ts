import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'

// 売上集計 API。
// ?from=YYYY-MM-DD&to=YYYY-MM-DD（必須、JST）
// ?storeId=N（任意、絞り込み）
//
// 売上の定義:
//   - 施術売上: status=CONFIRMED で VoucherUsage を持たない予約の menu.priceJpy 合計
//   - 物販売上: ProductSale.kind=PRODUCT の unitPriceJpyAtSale × quantity 合計
//   - 回数券販売: ProductSale.kind=VOUCHER の unitPriceJpyAtSale × quantity 合計
//
// 集計軸:
//   - 日別合計（折れ線表示用）
//   - 店舗別内訳（施術 / 物販 / 回数券販売）
//   - スタッフ別: 担当した予約の施術売上ランキング（Staff テーブル）
//   - 商品別: 物販・回数券をまとめて売上ランキング
//
// 注: Staff（店舗で働く人）と Login（ログインユーザー）は別テーブルなので、
//     「施術売上」は Staff 単位、「物販・回数券販売の担当者」は Login 単位で別軸になる。
//     既存 UI 互換のため byStaff は Staff の施術売上のみで集計する。
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sale:view')

  const query = getQuery(event)
  const fromStr = typeof query.from === 'string' ? query.from : ''
  const toStr = typeof query.to === 'string' ? query.to : ''
  const storeIdRaw = typeof query.storeId === 'string' ? Number(query.storeId) : null
  const storeId = Number.isInteger(storeIdRaw) && storeIdRaw && storeIdRaw > 0 ? storeIdRaw : null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromStr) || !/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
    throw createError({ statusCode: 400, statusMessage: 'from と to を YYYY-MM-DD で指定してください' })
  }

  // JST 0:00 を UTC 表現で持つ
  const start = new Date(`${fromStr}T00:00:00+09:00`)
  const end = new Date(new Date(`${toStr}T00:00:00+09:00`).getTime() + 86_400_000)

  const storeFilter = storeId ? { storeId } : {}

  const [stores, reservations, sales] = await Promise.all([
    prisma.store.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' }, select: { id: true, name: true } }),
    prisma.reservation.findMany({
      where: {
        status: 'CONFIRMED',
        startAt: { gte: start, lt: end },
        voucherUsage: { is: null }, // 回数券消費した予約は売上 0
        ...storeFilter,
      },
      select: {
        storeId: true,
        startAt: true,
        staffId: true,
        staff: { select: { id: true, name: true } },
        menu: { select: { id: true, name: true, priceJpy: true } },
      },
    }),
    prisma.productSale.findMany({
      where: { soldAt: { gte: start, lt: end }, ...storeFilter },
      select: {
        storeId: true,
        soldAt: true,
        quantity: true,
        unitPriceJpyAtSale: true,
        soldByLoginId: true,
        soldByLogin: { select: { id: true, displayName: true } },
        product: { select: { id: true, name: true, kind: true } },
      },
    }),
  ])

  function ymdJst(d: Date): string {
    const jst = new Date(d.getTime() + 9 * 3600_000)
    return jst.toISOString().slice(0, 10)
  }

  // 日別合計（日付 → { menu, product, voucher, total }）
  const byDay = new Map<string, { menu: number, product: number, voucher: number, total: number }>()
  // 店舗別
  const byStore = new Map<number, { storeId: number, storeName: string, menu: number, product: number, voucher: number, total: number }>()
  for (const s of stores) {
    if (storeId && s.id !== storeId) continue
    byStore.set(s.id, { storeId: s.id, storeName: s.name, menu: 0, product: 0, voucher: 0, total: 0 })
  }
  // スタッフ別
  const byStaff = new Map<number, { staffId: number, staffName: string, menu: number, product: number, voucher: number, total: number }>()
  // 商品別
  const byProduct = new Map<number, { productId: number, productName: string, kind: 'PRODUCT' | 'VOUCHER', quantity: number, revenue: number }>()

  function bumpDay(date: Date, key: 'menu' | 'product' | 'voucher', amount: number) {
    const ymd = ymdJst(date)
    const cur = byDay.get(ymd) ?? { menu: 0, product: 0, voucher: 0, total: 0 }
    cur[key] += amount
    cur.total += amount
    byDay.set(ymd, cur)
  }
  function bumpStore(sid: number, key: 'menu' | 'product' | 'voucher', amount: number) {
    const cur = byStore.get(sid)
    if (!cur) return
    cur[key] += amount
    cur.total += amount
  }
  function bumpStaff(sid: number | null | undefined, sname: string | null | undefined, key: 'menu' | 'product' | 'voucher', amount: number) {
    if (!sid) return
    const cur = byStaff.get(sid) ?? { staffId: sid, staffName: sname ?? `#${sid}`, menu: 0, product: 0, voucher: 0, total: 0 }
    cur[key] += amount
    cur.total += amount
    byStaff.set(sid, cur)
  }

  for (const r of reservations) {
    const amount = r.menu.priceJpy
    bumpDay(r.startAt, 'menu', amount)
    bumpStore(r.storeId, 'menu', amount)
    bumpStaff(r.staff.id, r.staff.name, 'menu', amount)
  }
  for (const s of sales) {
    const amount = s.unitPriceJpyAtSale * s.quantity
    const key = s.product.kind === 'VOUCHER' ? 'voucher' : 'product'
    bumpDay(s.soldAt, key, amount)
    bumpStore(s.storeId, key, amount)
    // 販売の担当者は Login（管理画面ログインユーザー）。Staff とは別空間なので byStaff には混ぜない。
    // 必要なら別軸（bySoldBy）として API レスポンスに追加する。
    const cur = byProduct.get(s.product.id) ?? { productId: s.product.id, productName: s.product.name, kind: s.product.kind, quantity: 0, revenue: 0 }
    cur.quantity += s.quantity
    cur.revenue += amount
    byProduct.set(s.product.id, cur)
  }

  // 日別を日付昇順で配列化（from〜to の全日付を埋める）
  const days: { date: string, menu: number, product: number, voucher: number, total: number }[] = []
  const fromDate = new Date(`${fromStr}T00:00:00+09:00`)
  const toDate = new Date(`${toStr}T00:00:00+09:00`)
  for (let t = fromDate.getTime(); t <= toDate.getTime(); t += 86_400_000) {
    const ymd = ymdJst(new Date(t))
    const bucket = byDay.get(ymd) ?? { menu: 0, product: 0, voucher: 0, total: 0 }
    days.push({ date: ymd, ...bucket })
  }

  // 合計
  const grandTotal = days.reduce((a, d) => ({
    menu: a.menu + d.menu,
    product: a.product + d.product,
    voucher: a.voucher + d.voucher,
    total: a.total + d.total,
  }), { menu: 0, product: 0, voucher: 0, total: 0 })

  return {
    from: fromStr,
    to: toStr,
    grandTotal,
    days,
    byStore: Array.from(byStore.values()),
    byStaff: Array.from(byStaff.values()).sort((a, b) => b.total - a.total),
    byProduct: Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue),
  }
})
