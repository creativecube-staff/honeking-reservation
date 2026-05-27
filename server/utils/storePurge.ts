// 店舗の完全削除（物理削除）ロジック。
// 全 FK が onDelete: Restrict のため、子→親の順で 1 トランザクション内に削除する。
// プレビュー（影響範囲の件数表示）と実削除で同じ id 収集ロジックを共有する。
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

// トランザクションでも通常クライアントでも使えるよう、モデルデリゲートだけ持つ型で受ける。
// PrismaClient は TransactionClient に構造的に代入可能なので両方渡せる。
type DbClient = Prisma.TransactionClient

// この店舗の削除で巻き込む子レコードの id 群を集める。
// - reservationIds: storeId がこの店舗の予約（予約のベッド・施術者は必ず同一店舗なので storeId で十分）
// - saleIds:        この店舗で売った販売 + この店舗の予約に紐づく販売
// - voucherIds:     上記販売から発行された顧客回数券
async function collectPurgeTargets(db: DbClient, storeId: number) {
  const practitionerIds = (await db.practitioner.findMany({ where: { storeId }, select: { id: true } })).map(p => p.id)
  const reservationIds = (await db.reservation.findMany({ where: { storeId }, select: { id: true } })).map(r => r.id)
  const saleIds = (await db.productSale.findMany({
    where: { OR: [{ storeId }, { reservationId: { in: reservationIds } }] },
    select: { id: true },
  })).map(s => s.id)
  const voucherIds = (await db.customerVoucher.findMany({
    where: { productSaleId: { in: saleIds } },
    select: { id: true },
  })).map(v => v.id)
  return { practitionerIds, reservationIds, saleIds, voucherIds }
}

export interface StorePurgeCounts {
  reservations: number
  productSales: number
  customerVouchers: number
  voucherUsages: number
  reservationHistories: number
  shifts: number
  menus: number
  products: number
  businessHours: number
  holidays: number
  closures: number
  beds: number
  practitioners: number
}

export interface StoreBlastRadius {
  counts: StorePurgeCounts
  // この店舗のスタッフが「他店」の予約を担当している件数。
  // > 0 なら完全削除で他店データを巻き込むため拒否する。
  crossStoreReservations: number
}

// 完全削除で消える/影響するデータ件数を集計する（読み取り専用）。
export async function computeStoreBlastRadius(storeId: number): Promise<StoreBlastRadius> {
  const { practitionerIds, reservationIds, saleIds, voucherIds } = await collectPurgeTargets(prisma, storeId)

  const [
    voucherUsages,
    reservationHistories,
    shifts,
    menus,
    products,
    businessHours,
    holidays,
    closures,
    beds,
    crossStoreReservations,
  ] = await Promise.all([
    prisma.voucherUsage.count({ where: { OR: [{ reservationId: { in: reservationIds } }, { customerVoucherId: { in: voucherIds } }] } }),
    prisma.reservationHistory.count({ where: { reservationId: { in: reservationIds } } }),
    prisma.shift.count({ where: { OR: [{ practitionerId: { in: practitionerIds } }, { workStoreId: storeId }] } }),
    prisma.menu.count({ where: { storeId } }),
    prisma.product.count({ where: { storeId } }),
    prisma.businessHour.count({ where: { storeId } }),
    prisma.holiday.count({ where: { storeId } }),
    prisma.closure.count({ where: { storeId } }),
    prisma.bed.count({ where: { storeId } }),
    prisma.reservation.count({ where: { practitionerId: { in: practitionerIds }, storeId: { not: storeId } } }),
  ])

  return {
    counts: {
      reservations: reservationIds.length,
      productSales: saleIds.length,
      customerVouchers: voucherIds.length,
      voucherUsages,
      reservationHistories,
      shifts,
      menus,
      products,
      businessHours,
      holidays,
      closures,
      beds,
      practitioners: practitionerIds.length,
    },
    crossStoreReservations,
  }
}

// 店舗を物理削除する。FK(Restrict)を満たす順序で 1 トランザクションにまとめる。
// 途中で 1 つでも失敗すれば全部ロールバックされる（部分削除は起きない）。
export async function purgeStore(storeId: number) {
  return prisma.$transaction(async (tx) => {
    const { practitionerIds, reservationIds, saleIds, voucherIds } = await collectPurgeTargets(tx, storeId)

    // 1. 回数券消費（この店舗の予約での消費 + この店舗で売った回数券の消費）
    await tx.voucherUsage.deleteMany({ where: { OR: [{ reservationId: { in: reservationIds } }, { customerVoucherId: { in: voucherIds } }] } })
    // 2. 顧客回数券（この店舗で売った分）
    await tx.customerVoucher.deleteMany({ where: { id: { in: voucherIds } } })
    // 3. 予約変更履歴（この店舗の予約の履歴）
    await tx.reservationHistory.deleteMany({ where: { reservationId: { in: reservationIds } } })
    // 操作者がこの店舗のスタッフだった「他店予約」の履歴は担当者を null に（履歴自体は残す）
    await tx.reservationHistory.updateMany({ where: { changedByPractitionerId: { in: practitionerIds } }, data: { changedByPractitionerId: null } })
    // 4. 販売記録
    await tx.productSale.deleteMany({ where: { id: { in: saleIds } } })
    // この店舗のスタッフが「他店」で売った販売は担当者を null に（販売自体は残す）
    await tx.productSale.updateMany({ where: { soldByPractitionerId: { in: practitionerIds } }, data: { soldByPractitionerId: null } })
    // 5. 予約
    await tx.reservation.deleteMany({ where: { id: { in: reservationIds } } })
    // 6. シフト（この店舗のスタッフ + この店舗へのヘルプ勤務）
    await tx.shift.deleteMany({ where: { OR: [{ practitionerId: { in: practitionerIds } }, { workStoreId: storeId }] } })
    // 7. 店舗特別メニュー
    await tx.menu.deleteMany({ where: { storeId } })
    // 8. 営業時間
    await tx.businessHour.deleteMany({ where: { storeId } })
    // 9. 店休日
    await tx.holiday.deleteMany({ where: { storeId } })
    // 10. 部分閉店
    await tx.closure.deleteMany({ where: { storeId } })
    // 11. 店舗特別商品
    await tx.product.deleteMany({ where: { storeId } })
    // 12. ベッド
    await tx.bed.deleteMany({ where: { storeId } })
    // 13. 施術者
    await tx.practitioner.deleteMany({ where: { storeId } })
    // 14. 店舗本体
    await tx.store.delete({ where: { id: storeId } })
  })
}
