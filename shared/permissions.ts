// 管理画面の権限定義。
// クライアント側のサイドバー制御・ボタン表示、サーバー側の API ガードで共通利用する。

// 全権限の一覧（"<resource>:<action>" 形式）
// スタッフ管理(staff:edit)にはログイン情報（ユーザー名・パスワード・役職・権限）の編集も含む。
// product:edit は商品マスタ（在庫・価格）の編集、sale:edit は販売登録と回数券消費。
export const ALL_PERMISSIONS = [
  'dashboard:view',
  'reservation:view',
  'reservation:edit',
  'reservation:cancel',
  'shift:view',
  'shift:edit',
  'menu:view',
  'menu:edit',
  'store:view',
  'store:edit',
  'staff:view',
  'staff:edit',
  'product:view',
  'product:edit',
  'sale:view',
  'sale:edit',
] as const

export type Permission = (typeof ALL_PERMISSIONS)[number]

// 役職（Prisma の Role enum と同じ値を文字列で持つ）
export const ROLES = ['OWNER', 'MANAGER', 'RECEPTIONIST', 'PRACTITIONER'] as const
export type RoleName = (typeof ROLES)[number]

// 役職の日本語表示名
export const ROLE_LABEL: Record<RoleName, string> = {
  OWNER: 'オーナー',
  MANAGER: '店長',
  RECEPTIONIST: '受付',
  PRACTITIONER: '施術者',
}

// 役職別のデフォルト権限。User.permissions で個別に追加・削除して上書きできる。
export const ROLE_DEFAULT_PERMISSIONS: Record<RoleName, Permission[]> = {
  // オーナー: 全権限
  OWNER: [...ALL_PERMISSIONS],
  // 店長: ユーザー管理含む全権限（オーナーと同等の運用）
  MANAGER: [...ALL_PERMISSIONS],
  // 受付: 予約管理中心 + シフト閲覧 + 物販・回数券販売
  RECEPTIONIST: [
    'dashboard:view',
    'reservation:view',
    'reservation:edit',
    'reservation:cancel',
    'shift:view',
    'menu:view',
    'staff:view',
    'product:view',
    'sale:view',
    'sale:edit',
  ],
  // 施術者: 自分の状況確認中心 + 物販・回数券販売
  PRACTITIONER: [
    'dashboard:view',
    'reservation:view',
    'shift:view',
    'product:view',
    'sale:view',
    'sale:edit',
  ],
}

// 役職のデフォルト権限と個別上書きを合成して最終的な権限セットを得る。
// 上書きは「追加」のみ。削除したい場合は role を変えるか、将来 deny 機構を入れる。
export function resolvePermissions(role: RoleName, overrides: string[] = []): Permission[] {
  const base = new Set<Permission>(ROLE_DEFAULT_PERMISSIONS[role])
  for (const p of overrides) {
    if ((ALL_PERMISSIONS as readonly string[]).includes(p)) {
      base.add(p as Permission)
    }
  }
  return Array.from(base)
}

// 権限の日本語表示名（管理画面で permission を編集する UI 用）
export const PERMISSION_LABEL: Record<Permission, string> = {
  'dashboard:view': 'ダッシュボード閲覧',
  'reservation:view': '予約閲覧',
  'reservation:edit': '予約作成・編集',
  'reservation:cancel': '予約キャンセル',
  'shift:view': 'シフト閲覧',
  'shift:edit': 'シフト編集',
  'menu:view': 'メニュー閲覧',
  'menu:edit': 'メニュー編集',
  'store:view': '店舗情報閲覧',
  'store:edit': '店舗情報編集',
  'staff:view': 'スタッフ閲覧',
  'staff:edit': 'スタッフ管理（ログイン情報・役職・権限の編集を含む）',
  'product:view': '商品閲覧',
  'product:edit': '商品マスタ管理（在庫・価格・回数券設定）',
  'sale:view': '販売履歴閲覧',
  'sale:edit': '販売登録・回数券消費',
}
