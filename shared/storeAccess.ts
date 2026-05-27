// 店舗アクセス境界の基本ルール（クライアント・サーバ共通）。
//
// 方針（確定済み）:
// - OWNER は全店舗を見られる（ヘッダーの店舗スイッチャーで「全店舗」も「各店」も選べる）
// - それ以外（MANAGER=店長 / RECEPTIONIST=受付 / PRACTITIONER=施術者）は所属店舗のみ
//
// ※ 役職ごとの「操作」権限は shared/permissions.ts が担当。ここは「どの店舗を見られるか」だけ。
import type { RoleName } from './permissions'

/** 全店舗にアクセスできる役職か（= OWNER のみ）。 */
export function canAccessAllStores(role: RoleName): boolean {
  return role === 'OWNER'
}
