// nuxt-auth-utils のセッション型拡張。
// `useUserSession()` の `user` プロパティと、サーバー側 `getUserSession()` で参照される。
//
// 1 つの cookie 内で 2 種類のセッションを併存させる:
// - user        : 管理画面ユーザー（Practitioner.role 保持者）
// - member      : お客様会員（Customer 保有者）
// 両方同時にログイン可能（開発者が両方テストできるようにするため）。

import type { Permission, RoleName } from '~~/shared/permissions'

declare module '#auth-utils' {
  interface User {
    id: number
    username: string
    displayName: string
    role: RoleName
    permissions: Permission[]
    // 所属店舗(Practitioner.storeId)。店舗スコープ(アクセス境界)の判定に使う。
    // OWNER は全店アクセスのため storeId は「ホーム店舗」程度の意味。
    storeId: number
  }

  // 会員（お客様）セッション
  // 表示用に name を decryptUtf8 した値を保存。email は /api/member/me で必要時のみ復号する。
  interface UserSessionMember {
    id: number
    name: string
  }

  // LINE Login 後、まだ Customer に紐付いていない中間状態の保持。
  // /api/auth/line/callback で記録 → /auth/line/link or /auth/line/signup で消費 → 確定で削除。
  // 一時的なものなので短時間（後段の API 側でも expiresAt を持って二重チェックする）。
  interface PendingLineLink {
    lineUserId: string
    lineDisplayName?: string
    // LINE Login の email scope で取得できた場合のみ入る（取れないユーザーも多い）。
    email?: string
    // 既存 Customer のメアドにヒットした場合の Customer ID（link フローでパスワード本人確認に使う）。
    matchedCustomerId?: number
    issuedAt: string
    // 連携/登録完了後にリダイレクトすべき先（予約フローの SPA に戻すための導線）。
    // 同一オリジン内の絶対パス（"/" 始まり）のみ許可。
    redirectAfter?: string
  }

  interface UserSession {
    loggedInAt?: string
    member?: UserSessionMember
    memberLoggedInAt?: string
    pendingLineLink?: PendingLineLink
  }
}

export {}
