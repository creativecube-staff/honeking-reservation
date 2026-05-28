import { prisma } from './prisma'

// メニューの完全削除（物理削除）まわりの共通ロジック。
// 共通メニュー（storeId IS NULL）と店舗特別メニュー（storeId = X）で同じ判定を使うため切り出し。
// Menu を参照する FK は Reservation.menuId のみ（ReservationHistory は menuId が FK 無しのスナップショット）。

export type MenuPurgeRow = { id: number, name: string, isActive: boolean, storeId: number | null }

/** 完全削除対象のメニュー本体を取得（共通/店舗特別を where で切り替え）。見つからなければ null。 */
export async function loadMenuForPurge(where: { id: number, storeId: number | null }): Promise<MenuPurgeRow | null> {
  return prisma.menu.findFirst({
    where,
    select: { id: true, name: true, isActive: true, storeId: true },
  })
}

/** このメニューを参照する予約の件数（履歴保護のため、0 件でないと完全削除できない）。 */
export async function countMenuReservations(menuId: number): Promise<number> {
  return prisma.reservation.count({ where: { menuId } })
}

/** 削除を拒否する理由（文章で返し、UI でそのまま表示する）。空配列なら canPurge=true。 */
export function buildMenuPurgeReasons(menu: { isActive: boolean }, reservations: number): string[] {
  const reasons: string[] = []
  if (menu.isActive) {
    reasons.push('有効なメニューは完全削除できません。先に無効化してください。')
  }
  if (reservations > 0) {
    reasons.push(`このメニューを使った予約が ${reservations} 件あります。履歴保護のため完全削除できません。`)
  }
  return reasons
}
