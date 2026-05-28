import { prisma } from './prisma'

// スタッフ（Staff）の完全削除（物理削除）まわりの共通ロジック。
// Staff を参照する FK:
//  - Reservation.staffId （onDelete: Restrict）
// なので、reservations > 0 のときだけ削除拒否すれば足りる。
// （Login は Staff と無関係。販売記録は Login.id 参照に切替済み）

export type StaffPurgeRow = {
  id: number
  storeId: number
  name: string
  isActive: boolean
}

/** 削除対象スタッフ本体を取得。見つからなければ null。 */
export async function loadStaffForPurge(where: { id: number, storeId: number }): Promise<StaffPurgeRow | null> {
  return prisma.staff.findFirst({
    where,
    select: { id: true, storeId: true, name: true, isActive: true },
  })
}

/** このスタッフを担当者とする予約の件数。 */
export async function countStaffReservations(staffId: number): Promise<number> {
  return prisma.reservation.count({ where: { staffId } })
}

/** 削除を拒否する理由（文章で返し、UI でそのまま表示する）。空配列なら canPurge=true。 */
export function buildStaffPurgeReasons(
  staff: { isActive: boolean },
  reservations: number,
): string[] {
  const reasons: string[] = []
  if (staff.isActive) {
    reasons.push('有効なスタッフは完全削除できません。先に無効化してください。')
  }
  if (reservations > 0) {
    reasons.push(`このスタッフが担当した予約が ${reservations} 件あります。履歴保護のため完全削除できません。`)
  }
  return reasons
}
