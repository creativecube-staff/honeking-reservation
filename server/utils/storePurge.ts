// 店舗の完全削除（物理削除）ロジック。
// 全 FK が onDelete: Restrict のため、子→親の順で 1 トランザクション内に削除する。
// プレビュー（影響範囲の件数表示）と実削除で同じ id 収集ロジックを共有する。
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

// トランザクションでも通常クライアントでも使えるよう、モデルデリゲートだけ持つ型で受ける。
// PrismaClient は TransactionClient に構造的に代入可能なので両方渡せる。
type DbClient = Prisma.TransactionClient

// この店舗の削除で巻き込む子レコードの id 群を集める。
// - reservationIds: storeId がこの店舗の予約
// - saleIds:        この店舗で売った販売 + この店舗の予約に紐づく販売
// - voucherIds:     上記販売から発行された顧客回数券
// - staffIds:       この店舗所属のスタッフ
// - loginIds:       この店舗所属のログインアカウント
async function collectPurgeTargets(db: DbClient, storeId: number) {
  const staffIds = (await db.staff.findMany({ where: { storeId }, select: { id: true } })).map(s => s.id)
  const loginIds = (await db.login.findMany({ where: { storeId }, select: { id: true } })).map(l => l.id)
  const reservationIds = (await db.reservation.findMany({ where: { storeId }, select: { id: true } })).map(r => r.id)
  const saleIds = (await db.productSale.findMany({
    where: { OR: [{ storeId }, { reservationId: { in: reservationIds } }] },
    select: { id: true },
  })).map(s => s.id)
  const voucherIds = (await db.customerVoucher.findMany({
    where: { productSaleId: { in: saleIds } },
    select: { id: true },
  })).map(v => v.id)
  return { staffIds, loginIds, reservationIds, saleIds, voucherIds }
}

export interface StorePurgeCounts {
  reservations: number
  productSales: number
  customerVouchers: number
  voucherUsages: number
  reservationHistories: number
  menus: number
  products: number
  businessHours: number
  holidays: number
  beds: number
  staffs: number
  logins: number
}

export interface StoreBlastRadius {
  counts: StorePurgeCounts
  // この店舗のスタッフが「他店」の予約を担当している件数。
  // > 0 なら完全削除で他店データを巻き込むため拒否する。
  crossStoreReservations: number
}

// 完全削除で消える/影響するデータ件数を集計する（読み取り専用）。
export async function computeStoreBlastRadius(storeId: number): Promise<StoreBlastRadius> {
  const { staffIds, loginIds, reservationIds, saleIds, voucherIds } = await collectPurgeTargets(prisma, storeId)

  const [
    voucherUsages,
    reservationHistories,
    menus,
    products,
    businessHours,
    holidays,
    beds,
    crossStoreReservations,
  ] = await Promise.all([
    prisma.voucherUsage.count({ where: { OR: [{ reservationId: { in: reservationIds } }, { customerVoucherId: { in: voucherIds } }] } }),
    prisma.reservationHistory.count({ where: { reservationId: { in: reservationIds } } }),
    prisma.menu.count({ where: { storeId } }),
    prisma.product.count({ where: { storeId } }),
    prisma.businessHour.count({ where: { storeId } }),
    prisma.holiday.count({ where: { storeId } }),
    prisma.bed.count({ where: { storeId } }),
    // この店舗所属のスタッフが「他店」予約を担当しているか（Staff は storeId と別の店舗で予約を持てる仕組みは今は無いが、念のため検知）
    prisma.reservation.count({ where: { staffId: { in: staffIds }, storeId: { not: storeId } } }),
  ])

  return {
    counts: {
      reservations: reservationIds.length,
      productSales: saleIds.length,
      customerVouchers: voucherIds.length,
      voucherUsages,
      reservationHistories,
      menus,
      products,
      businessHours,
      holidays,
      beds,
      staffs: staffIds.length,
      logins: loginIds.length,
    },
    crossStoreReservations,
  }
}

// 店舗を物理削除する。FK(Restrict)を満たす順序で 1 トランザクションにまとめる。
// 途中で 1 つでも失敗すれば全部ロールバックされる（部分削除は起きない）。
export async function purgeStore(storeId: number) {
  return prisma.$transaction(async (tx) => {
    const { staffIds, loginIds, reservationIds, saleIds, voucherIds } = await collectPurgeTargets(tx, storeId)

    // 1. 回数券消費（この店舗の予約での消費 + この店舗で売った回数券の消費）
    await tx.voucherUsage.deleteMany({ where: { OR: [{ reservationId: { in: reservationIds } }, { customerVoucherId: { in: voucherIds } }] } })
    // 2. 顧客回数券（この店舗で売った分）
    await tx.customerVoucher.deleteMany({ where: { id: { in: voucherIds } } })
    // 3. 予約変更履歴（この店舗の予約の履歴）
    await tx.reservationHistory.deleteMany({ where: { reservationId: { in: reservationIds } } })
    // 操作者がこの店舗のログインユーザーだった「他店予約」の履歴は担当者を null に（履歴自体は残す）
    await tx.reservationHistory.updateMany({ where: { changedByLoginId: { in: loginIds } }, data: { changedByLoginId: null } })
    // 4. 販売記録
    await tx.productSale.deleteMany({ where: { id: { in: saleIds } } })
    // この店舗のログインユーザーが「他店」で売った販売は担当者を null に（販売自体は残す）
    await tx.productSale.updateMany({ where: { soldByLoginId: { in: loginIds } }, data: { soldByLoginId: null } })
    // 5. 予約
    await tx.reservation.deleteMany({ where: { id: { in: reservationIds } } })
    // 6. メニューに関する除外設定（FK Restrict 対応）。
    //    - storeId 一致: この店舗を「非表示」にしている共通メニューの除外行
    //    - menuId 一致: 次のステップで消す店舗特別メニューを参照する除外行（設計上は無いがガード）
    const storeMenuIds = (await tx.menu.findMany({ where: { storeId }, select: { id: true } })).map(m => m.id)
    await tx.menuStoreExclusion.deleteMany({
      where: { OR: [{ storeId }, { menuId: { in: storeMenuIds } }] },
    })
    // 7. 店舗特別メニュー
    await tx.menu.deleteMany({ where: { storeId } })
    // 8. 営業時間
    await tx.businessHour.deleteMany({ where: { storeId } })
    // 9. 店休日
    await tx.holiday.deleteMany({ where: { storeId } })
    // 10. 店舗特別商品
    await tx.product.deleteMany({ where: { storeId } })
    // 11. ベッド
    await tx.bed.deleteMany({ where: { storeId } })
    // 12. スタッフ
    await tx.staff.deleteMany({ where: { storeId } })
    // 13. ログインアカウント（LoginHistory は onDelete: SetNull なので残る）
    await tx.login.deleteMany({ where: { storeId } })
    // 14. 店舗本体
    await tx.store.delete({ where: { id: storeId } })
  })
}
